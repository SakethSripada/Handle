import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Engine } from '../core/engine.js';
import { token } from '../core/crypto.js';
import { auth } from './auth.js';
import { callVariables } from '../core/demo.js';

export function rehearsal(engine: Engine) {
    const router = Router();
    const { store, config, voice } = engine;

    router.use(auth(config, store));
    router.post('/:id/rehearse', async (req, res) => {
        const source = store.case(String(req.params.id));

        if (!source || !source.goal) {
            throw new Error('Gather the request details first.');
        }

        if (source.mode === 'demo') {
            throw new Error(
                'Use a customer-service request for a browser rehearsal.',
            );
        }

        if (
            store
                .cases()
                .some(
                    (c) =>
                        c.mode === 'rehearsal' &&
                        ['dialing', 'in_call', 'waiting_approval'].includes(
                            c.status,
                        ),
                )
        ) {
            throw new Error('End the existing rehearsal first.');
        }

        const { signed_url } = await voice.request<{
            signed_url: string;
        }>(
            `/convai/conversation/get_signed_url?agent_id=${config.ELEVENLABS_AGENT_ID}`,
        );
        const c = await store.saveCase({
            ...source,
            id: randomUUID(),
            title: `Rehearsal · ${source.title.replace(/^Rehearsal · /, '')}`,
            mode: 'rehearsal',
            status: 'in_call',
            createdAt: Date.now(),
            callToken: token(),
            conversationId: undefined,
            callSid: undefined,
            sipCallId: undefined,
            voiceProvider: undefined,
            stopRequestedAt: undefined,
            outcome: undefined,
            proposedOutcome: undefined,
            confirmation: undefined,
            confirmedAt: undefined,
            memoryExcluded: true,
            callMetrics: undefined,
        });

        await store.event(
            c.id,
            'status',
            'system',
            'Browser rehearsal started. No telephone call is being placed.',
        );
        res.json({
            caseId: c.id,
            signedUrl: signed_url,
            dynamicVariables: callVariables(c),
        });
    });
    router.post('/:id/rehearsal-event', async (req, res) => {
        const c = store.case(String(req.params.id));

        if (!c || c.mode !== 'rehearsal') {
            res.sendStatus(404);

            return;
        }

        const data = z
            .object({
                conversationId: z.string().optional(),
                role: z.enum(['user', 'agent']).optional(),
                message: z.string().max(10000).optional(),
                eventId: z.string().optional(),
                ended: z.boolean().optional(),
            })
            .parse(req.body);

        if (data.conversationId) {
            await store.saveCase({ ...c, conversationId: data.conversationId });
        }

        if (data.message && data.role) {
            await store.event(
                c.id,
                'transcript',
                data.role === 'agent' ? 'handle' : 'business',
                data.message,
                `browser:${c.id}:${data.eventId ?? randomUUID()}`,
            );
        }

        if (
            data.ended &&
            ['dialing', 'in_call', 'waiting_approval'].includes(c.status)
        ) {
            await store.saveCase({
                ...c,
                status: c.proposedOutcome ? 'verifying' : 'follow_up',
                callToken: undefined,
                outcome:
                    'Browser rehearsal ended without a confirmed resolution.',
            });
        }

        res.json({ ok: true });
    });

    return router;
}
