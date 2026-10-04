import { Router, raw } from 'express';
import { z } from 'zod';
import { equal, token, verifyElevenSignature } from '../core/crypto.js';
import { VoiceTools } from '../core/voice-tools.js';
import type { Engine } from '../core/engine.js';
import type { CallMonitor } from '../core/call-monitor.js';
import { cookie } from './auth.js';

export function callbacks(engine: Engine, monitor: CallMonitor) {
    const router = Router();
    const { config, store, gmail } = engine;
    const tools = new VoiceTools(engine);

    router.post(
        '/webhooks/elevenlabs',
        raw({ type: 'application/json', limit: '2mb' }),
        async (req, res) => {
            if (
                !verifyElevenSignature(
                    req.body,
                    req.get('elevenlabs-signature') ?? '',
                    config.ELEVENLABS_WEBHOOK_SECRET,
                )
            ) {
                res.sendStatus(401);

                return;
            }

            const event = JSON.parse(req.body.toString());

            if (event.type === 'post_call_transcription') {
                const c = store
                    .cases()
                    .find(
                        (c) => c.conversationId === event.data.conversation_id,
                    );

                if (c) {
                    await monitor.apply(c.id, event.data);
                }
            }

            res.json({ received: true });
        },
    );
    router.get('/connect/gmail/:id', async (req, res) => {
        const browserToken = token();
        const url = await gmail.begin(String(req.params.id), browserToken);

        res.cookie('handle_oauth', browserToken, {
            httpOnly: true,
            secure: config.PUBLIC_URL.startsWith('https:'),
            sameSite: 'lax',
            maxAge: 600000,
        });
        res.redirect(url);
    });
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

    return {
        router,
        toolHandler: Router().post('/:caseId/:name', async (req, res) => {
            const c = store.case(String(req.params.caseId));

            if (
                !c?.callToken ||
                !equal(req.get('x-handle-token') ?? '', c.callToken)
            ) {
                res.sendStatus(401);

                return;
            }

            if (
                !['dialing', 'in_call', 'waiting_approval'].includes(c.status)
            ) {
                res.status(409).json({
                    error: 'This case is no longer active.',
                });

                return;
            }

            res.json(await tools.run(c, String(req.params.name), req.body));
        }),
    };
}

function gmailPage(title: string, message: string) {
    // Both arguments are fixed application copy, never provider or query values.
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Gmail · Handle</title></head><body style="background:#f5f4ed;color:#1a2923;font:18px/1.6 system-ui;padding:10vw;max-width:640px"><h1>${title}</h1><p>${message}</p><p>You can return to iMessage or close this tab.</p></body></html>`;
}
