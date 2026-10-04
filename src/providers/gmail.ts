import { createHash } from 'node:crypto';
import type { Config } from '../config.js';
import { Store } from '../core/store.js';
import { seal, unseal, token } from '../core/crypto.js';
import { jsonRequest } from './http.js';

interface Tokens {
    access_token: string;
    refresh_token?: string;
    expires_at: number;
    email?: string;
}

interface OAuthState {
    owner: string;
    verifier: string;
    expiresAt: number;
    browserToken: string;
}

interface GmailPart {
    mimeType?: string;
    body?: { data?: string };
    parts?: GmailPart[];
}

interface GmailMessage {
    id: string;
    snippet: string;
    payload?: GmailPart & { headers?: { name: string; value: string }[] };
}

export interface MailEvidence {
    id: string;
    subject: string;
    from: string;
    date: string;
    body: string;
    url: string;
}

function plainText(part: GmailPart): string {
    if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64url').toString();
    }

    const nested = (part.parts ?? []).map(plainText).filter(Boolean).join('\n');

    if (nested) {
        return nested;
    }

    if (part.mimeType === 'text/html' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64url')
            .toString()
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ');
    }

    return '';
}

export class Gmail {
    constructor(
        private config: Config,
        private store: Store,
    ) {}

    get configured() {
        return Boolean(
            this.config.GOOGLE_CLIENT_ID && this.config.GOOGLE_CLIENT_SECRET,
        );
    }

    connected(owner: string) {
        return Boolean(this.store.get('gmail', owner));
    }

    connectionLink(owner: string) {
        if (!this.configured) {
            throw new Error('Gmail OAuth is not configured yet.');
        }

        const id = token();

        this.store.put('connect-link', id, {
            owner,
            expiresAt: Date.now() + 600000,
        });

        return `${this.config.PUBLIC_URL}/connect/gmail/${id}`;
    }

    begin(id: string, browserToken: string) {
        const link = this.store.get<{ owner: string; expiresAt: number }>(
            'connect-link',
            id,
        );

        if (!link || link.expiresAt < Date.now()) {
            throw new Error(
                'This connection link expired. Request a fresh link from Handle.',
            );
        }

        this.store.remove('connect-link', id);

        const state = token();
        const verifier = token();

        this.store.put<OAuthState>('oauth-state', state, {
            owner: link.owner,
            verifier,
            browserToken,
            expiresAt: Date.now() + 600000,
        });

        const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');

        url.search = new URLSearchParams({
            client_id: this.config.GOOGLE_CLIENT_ID,
            redirect_uri: this.redirectUri,
            response_type: 'code',
            scope: 'https://www.googleapis.com/auth/gmail.readonly',
            access_type: 'offline',
            prompt: 'consent',
            state,
            code_challenge: createHash('sha256')
                .update(verifier)
                .digest('base64url'),
            code_challenge_method: 'S256',
        }).toString();

        return url.toString();
    }

    get redirectUri() {
        return `${this.config.PUBLIC_URL}/oauth/google/callback`;
    }

    async callback(state: string, code: string, browserToken: string) {
        const saved = this.store.get<OAuthState>('oauth-state', state);

        this.store.remove('oauth-state', state);

        if (
            !saved ||
            saved.expiresAt < Date.now() ||
            saved.browserToken !== browserToken
        ) {
            throw new Error('Invalid or expired OAuth state.');
        }

        const result = await this.exchange({
            code,
            code_verifier: saved.verifier,
            redirect_uri: this.redirectUri,
            grant_type: 'authorization_code',
        });
        const profile = await jsonRequest<{ emailAddress: string }>(
            'Gmail',
            'https://gmail.googleapis.com/gmail/v1/users/me/profile',
            { headers: { Authorization: `Bearer ${result.access_token}` } },
        );

        this.store.put(
            'gmail',
            saved.owner,
            seal(
                { ...result, email: profile.emailAddress },
                this.config.ENCRYPTION_KEY,
            ),
        );

        return { owner: saved.owner, email: profile.emailAddress };
    }

    private async exchange(params: Record<string, string>): Promise<Tokens> {
        const result = await jsonRequest<{
            access_token: string;
            refresh_token?: string;
            expires_in: number;
        }>('Google OAuth', 'https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                ...params,
                client_id: this.config.GOOGLE_CLIENT_ID,
                client_secret: this.config.GOOGLE_CLIENT_SECRET,
            }),
        });

        return { ...result, expires_at: Date.now() + result.expires_in * 1000 };
    }

    private async accessToken(owner: string) {
        const encrypted = this.store.get<string>('gmail', owner);

        if (!encrypted) {
            throw new Error('Gmail is not connected for this user.');
        }

        let creds = unseal<Tokens>(encrypted, this.config.ENCRYPTION_KEY);

        if (creds.expires_at < Date.now() + 60000) {
            if (!creds.refresh_token) {
                throw new Error('Reconnect Gmail to refresh access.');
            }

            creds = {
                ...creds,
                ...(await this.exchange({
                    refresh_token: creds.refresh_token,
                    grant_type: 'refresh_token',
                })),
            };
            this.store.put(
                'gmail',
                owner,
                seal(creds, this.config.ENCRYPTION_KEY),
            );
        }

        return creds.access_token;
    }

    async search(owner: string, query: string): Promise<MailEvidence[]> {
        if (!query.trim() || query.length > 500) {
            throw new Error('Use a short, specific email search.');
        }

        const headers = {
            Authorization: `Bearer ${await this.accessToken(owner)}`,
        };
        const list = await jsonRequest<{ messages?: { id: string }[] }>(
            'Gmail',
            `https://gmail.googleapis.com/gmail/v1/users/me/messages?${new URLSearchParams({ q: query, maxResults: '5' })}`,
            { headers },
        );

        return Promise.all(
            (list.messages ?? []).map(async ({ id }) => {
                const message = await jsonRequest<GmailMessage>(
                    'Gmail',
                    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`,
                    { headers },
                );
                const header = (name: string) =>
                    message.payload?.headers?.find(
                        (h) => h.name.toLowerCase() === name,
                    )?.value ?? '';

                return {
                    id,
                    subject: header('subject'),
                    from: header('from'),
                    date: header('date'),
                    body: (message.payload
                        ? plainText(message.payload)
                        : message.snippet
                    ).slice(0, 10000),
                    url: `https://mail.google.com/mail/u/0/#all/${id}`,
                };
            }),
        );
    }

    async disconnect(owner: string) {
        const value = this.store.get<string>('gmail', owner);

        if (value) {
            const creds = unseal<Tokens>(value, this.config.ENCRYPTION_KEY);
            const response = await fetch(
                'https://oauth2.googleapis.com/revoke',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        token: creds.refresh_token ?? creds.access_token,
                    }),
                    signal: AbortSignal.timeout(15000),
                },
            );

            if (!response.ok && response.status !== 400) {
                throw new Error('Google could not revoke access. Try again.');
            }
        }

        this.store.remove('gmail', owner);
    }
}
