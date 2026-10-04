import { Router, raw } from 'express';
import { equal, verifyElevenSignature } from '../core/crypto.js';
import { VoiceTools } from '../core/voice-tools.js';
import type { Engine } from '../core/engine.js';
import type { CallMonitor } from '../core/call-monitor.js';
import { gmailOAuth } from './gmail-oauth.js';

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
    router.use(gmailOAuth(config, gmail));

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
