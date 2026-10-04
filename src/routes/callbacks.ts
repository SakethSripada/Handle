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
        if (req.query.error) {
            res.status(400).send(
                'Gmail was not connected. You can return to Handle and try again.',
            );

            return;
        }

        const { state, code } = z
            .object({ state: z.string(), code: z.string() })
            .parse(req.query);

        await gmail.callback(state, code, cookie(req, 'handle_oauth'));
        res.clearCookie('handle_oauth');
        res.type('html').send(
            '<!doctype html><html><meta name="viewport" content="width=device-width"><title>Gmail connected · Handle</title><body style="background:#f5f4ed;color:#1a2923;font:20px system-ui;padding:10vw"><h1>Gmail is connected.</h1><p>Handle can now look up receipts, reservations, and confirmations relevant to your requests.</p><p>You can return to iMessage or close this tab.</p></body></html>',
        );
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
