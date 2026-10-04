import { Router, urlencoded } from 'express';
import { z } from 'zod';
import type { Config } from '../config.js';
import type { Gmail } from '../providers/gmail.js';
import { equal, token } from '../core/crypto.js';
import { cookie } from './auth.js';

export function gmailOAuth(config: Config, gmail: Gmail) {
    const router = Router();
    const secure = config.PUBLIC_URL.startsWith('https:');

    router.use(
        ['/connect/gmail', '/oauth/google/callback'],
        (_req, res, next) => {
            res.set({
                'Cache-Control': 'no-store',
                'Referrer-Policy': 'same-origin',
                'X-Frame-Options': 'DENY',
            });
            next();
        },
    );
    // Messaging previews fetch links automatically. Only a submitted form starts OAuth.
    router.get('/connect/gmail/:id', (req, res) => {
        if (!gmail.connectionAvailable(String(req.params.id))) {
            res.status(410).type('html').send(expiredPage());

            return;
        }

        const csrf = token();

        res.cookie('handle_gmail_start', csrf, {
            httpOnly: true,
            secure,
            sameSite: 'strict',
            path: req.path,
            maxAge: 600000,
        });
        res.type('html').send(
            gmailPage(
                'Connect Gmail to Handle',
                'Choose your Google account on the next screen. Handle requests read-only access to find emails relevant to your requests.',
                csrf,
            ),
        );
    });
    router.post(
        '/connect/gmail/:id',
        urlencoded({ extended: false, limit: '2kb' }),
        async (req, res) => {
            const csrf = cookie(req, 'handle_gmail_start');

            if (
                !csrf ||
                typeof req.body?.csrf !== 'string' ||
                !equal(csrf, req.body.csrf)
            ) {
                res.status(403)
                    .type('html')
                    .send(
                        gmailPage(
                            'Open the connection link again.',
                            'Use the Continue with Google button in the same browser. No access has been granted.',
                        ),
                    );

                return;
            }

            if (!gmail.connectionAvailable(String(req.params.id))) {
                res.status(410).type('html').send(expiredPage());

                return;
            }

            const browserToken = token();
            const url = await gmail.begin(String(req.params.id), browserToken);

            res.clearCookie('handle_gmail_start', { path: req.path });
            res.cookie('handle_oauth', browserToken, {
                httpOnly: true,
                secure,
                sameSite: 'lax',
                maxAge: 600000,
            });
            res.redirect(303, url);
        },
    );
    router.get('/oauth/google/callback', async (req, res) => {
        res.clearCookie('handle_oauth', { path: '/' });

        try {
            const state = z.string().min(1).parse(req.query.state);
            const browserToken = cookie(req, 'handle_oauth');

            if (req.query.error) {
                await gmail.cancel(state, browserToken);
                res.status(400)
                    .type('html')
                    .send(
                        gmailPage(
                            'Gmail was not connected.',
                            'No new access was granted. Return to Handle and request a new connection link when you are ready.',
                        ),
                    );

                return;
            }

            const code = z.string().min(1).parse(req.query.code);

            await gmail.callback(state, code, browserToken);
            res.type('html').send(
                gmailPage(
                    'Gmail is connected.',
                    'Handle can now find receipts, reservations, and confirmations relevant to your requests. You can disconnect it in the dashboard at any time.',
                ),
            );
        } catch {
            res.status(400)
                .type('html')
                .send(
                    gmailPage(
                        'Gmail could not connect.',
                        'Return to Handle and request a fresh connection link. Open it and complete Google’s consent in the same browser, within ten minutes.',
                    ),
                );
        }
    });

    return router;
}

function expiredPage() {
    return gmailPage(
        'Request a new connection link.',
        'This link was already used or its ten-minute window has ended. Text “connect gmail” to Handle for a fresh one.',
    );
}

function gmailPage(title: string, message: string, csrf?: string) {
    // Copy is fixed; the optional form value is a server-generated random hex token.
    const action = csrf
        ? `<form method="post"><input type="hidden" name="csrf" value="${csrf}"><button type="submit">Continue with Google</button></form>`
        : '<p>You can return to iMessage or close this tab.</p>';

    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="referrer" content="same-origin">
    <title>Gmail · Handle</title>
    <style>
        body { background: #f5f4ed; color: #1a2923; font: 18px/1.6 system-ui; padding: 10vw; max-width: 640px; margin: auto; }
        h1 { line-height: 1.2; }
        button { background: #1a2923; color: white; border: 0; border-radius: 12px; padding: 14px 22px; font: inherit; cursor: pointer; }
    </style>
</head>
<body>
    <h1>${title}</h1>
    <p>${message}</p>
    ${action}
</body>
</html>`;
}
