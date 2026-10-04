import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { loadConfig } from '../src/config.js';
import { LocalStore } from '../src/core/local-store.js';
import { seal, unseal } from '../src/core/crypto.js';
import { Gmail } from '../src/providers/gmail.js';

process.env.DASHBOARD_TOKEN = 'test-token-'.repeat(4);
process.env.ENCRYPTION_KEY = 'ab'.repeat(32);

const owner = '+12025550142';

function setup() {
    const config = {
        ...loadConfig(),
        PUBLIC_URL: 'https://handle.example',
        GOOGLE_CLIENT_ID: 'test-client',
        GOOGLE_CLIENT_SECRET: 'test-secret',
    };
    const store = new LocalStore(':memory:');

    return { config, store, gmail: new Gmail(config, store) };
}

async function begin(gmail: Gmail) {
    const link = new URL(await gmail.connectionLink(owner));

    return new URL(
        await gmail.begin(link.pathname.split('/').at(-1)!, 'browser-one'),
    );
}

test('Gmail binds a one-use consent link to its browser, owner, PKCE and original redirect', async (t) => {
    const { config, store, gmail } = setup();
    const url = await begin(gmail);
    const state = url.searchParams.get('state')!;
    const saved = store.get<{ verifier: string }>('oauth-state', state)!;

    assert.equal(
        url.searchParams.get('scope'),
        'https://www.googleapis.com/auth/gmail.readonly',
    );
    assert.equal(
        url.searchParams.get('code_challenge'),
        createHash('sha256').update(saved.verifier).digest('base64url'),
    );

    const fetch = t.mock.method(
        globalThis,
        'fetch',
        async (url: string, init: RequestInit) => {
            if (url.includes('/token')) {
                const params = new URLSearchParams(String(init.body));

                assert.equal(params.get('code_verifier'), saved.verifier);
                assert.equal(
                    params.get('redirect_uri'),
                    'https://handle.example/oauth/google/callback',
                );

                return Response.json({
                    access_token: 'private-access',
                    refresh_token: 'private-refresh',
                    expires_in: 3600,
                });
            }

            return Response.json({ emailAddress: 'test@example.com' });
        },
    );

    await assert.rejects(
        gmail.callback(state, 'code', 'another-browser'),
        /Invalid or expired/,
    );
    assert.equal(fetch.mock.callCount(), 0);
    config.PUBLIC_URL = 'https://replacement.example';
    await gmail.callback(state, 'code', 'browser-one');
    assert.equal(gmail.connected(owner), true);
    assert.equal(gmail.connected('another-owner'), false);

    const encrypted = store.get<string>('gmail', owner)!;

    assert.ok(!encrypted.includes('private-access'));
    assert.equal(
        unseal<{ refresh_token: string }>(encrypted, config.ENCRYPTION_KEY)
            .refresh_token,
        'private-refresh',
    );
    await assert.rejects(
        gmail.callback(state, 'code', 'browser-one'),
        /Invalid or expired/,
    );
    assert.equal(fetch.mock.callCount(), 2);
});

test('Gmail consent links cannot be opened twice concurrently', async () => {
    const { gmail } = setup();
    const id = new URL(await gmail.connectionLink(owner)).pathname
        .split('/')
        .at(-1)!;
    const attempts = await Promise.allSettled([
        gmail.begin(id, 'first'),
        gmail.begin(id, 'second'),
    ]);

    assert.equal(attempts.filter((a) => a.status === 'fulfilled').length, 1);
});

test('Gmail rejects expired state and consumes cancelled consent without connecting', async () => {
    const { store, gmail } = setup();
    const url = await begin(gmail);
    const state = url.searchParams.get('state')!;

    await gmail.cancel(state, 'browser-one');
    assert.equal(store.get('oauth-state', state), undefined);
    assert.equal(gmail.connected(owner), false);

    const expired = (await begin(gmail)).searchParams.get('state')!;

    await store.put('oauth-state', expired, {
        ...store.get<object>('oauth-state', expired),
        expiresAt: 0,
    });
    await assert.rejects(
        gmail.callback(expired, 'code', 'browser-one'),
        /Invalid or expired/,
    );
});

test('Gmail refresh preserves the refresh token and returns no credentials from status', async (t) => {
    const { config, store, gmail } = setup();

    await store.put(
        'gmail',
        owner,
        seal(
            { access_token: 'old', refresh_token: 'keep-me', expires_at: 0 },
            config.ENCRYPTION_KEY,
        ),
    );
    t.mock.method(
        globalThis,
        'fetch',
        async (url: string, init: RequestInit) => {
            if (url.includes('/token')) {
                assert.equal(
                    new URLSearchParams(String(init.body)).get('refresh_token'),
                    'keep-me',
                );

                return Response.json({ access_token: 'new', expires_in: 3600 });
            }

            assert.equal(
                new Headers(init.headers).get('Authorization'),
                'Bearer new',
            );

            return Response.json({ emailAddress: 'test@example.com' });
        },
    );
    assert.deepEqual(await gmail.checkConnection(owner), {
        connected: true,
        email: 'test@example.com',
    });
    assert.equal(
        unseal<{ refresh_token: string }>(
            store.get<string>('gmail', owner)!,
            config.ENCRYPTION_KEY,
        ).refresh_token,
        'keep-me',
    );
});

test('revoked Gmail refresh access clears the connected state', async (t) => {
    const { config, store, gmail } = setup();

    await store.put(
        'gmail',
        owner,
        seal(
            { access_token: 'old', refresh_token: 'revoked', expires_at: 0 },
            config.ENCRYPTION_KEY,
        ),
    );
    t.mock.method(globalThis, 'fetch', async () =>
        Response.json({ error: 'invalid_grant' }, { status: 400 }),
    );
    await assert.rejects(
        gmail.checkConnection(owner),
        /expired or was revoked/,
    );
    assert.equal(gmail.connected(owner), false);
});

test('Gmail refresh cannot recreate a disconnected account', async (t) => {
    const { config, store, gmail } = setup();

    await store.put(
        'gmail',
        owner,
        seal(
            { access_token: 'old', refresh_token: 'refresh', expires_at: 0 },
            config.ENCRYPTION_KEY,
        ),
    );
    t.mock.method(globalThis, 'fetch', async () => {
        await store.remove('gmail', owner);

        return Response.json({ access_token: 'new', expires_in: 3600 });
    });
    await assert.rejects(gmail.checkConnection(owner), /connection changed/);
    assert.equal(gmail.connected(owner), false);
});

test('Gmail searches only the requested account and decodes matching email evidence', async (t) => {
    const { config, store, gmail } = setup();

    await store.put(
        'gmail',
        owner,
        seal(
            { access_token: 'access', expires_at: Date.now() + 3600000 },
            config.ENCRYPTION_KEY,
        ),
    );

    const fetch = t.mock.method(
        globalThis,
        'fetch',
        async (url: string, init: RequestInit) => {
            assert.equal(
                new Headers(init.headers).get('Authorization'),
                'Bearer access',
            );

            if (url.includes('?q=')) {
                assert.equal(
                    new URL(url).searchParams.get('q'),
                    'subject:reservation',
                );
                assert.equal(new URL(url).searchParams.get('maxResults'), '5');

                return Response.json({ messages: [{ id: 'message-one' }] });
            }

            return Response.json({
                id: 'message-one',
                payload: {
                    mimeType: 'multipart/alternative',
                    headers: [
                        { name: 'Subject', value: 'Reservation confirmed' },
                    ],
                    parts: [
                        {
                            mimeType: 'text/plain',
                            body: {
                                data: Buffer.from(
                                    'Booking ABC123 at 6 pm.',
                                ).toString('base64url'),
                            },
                        },
                    ],
                },
            });
        },
    );

    await assert.rejects(
        gmail.search('other-owner', 'subject:reservation'),
        /not connected/,
    );
    assert.equal(fetch.mock.callCount(), 0);

    const result = await gmail.search(owner, 'subject:reservation');

    assert.equal(result[0].subject, 'Reservation confirmed');
    assert.equal(result[0].body, 'Booking ABC123 at 6 pm.');
});
