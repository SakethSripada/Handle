import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { CaseEvent } from '../core/model.js';
import type { Engine } from '../core/engine.js';
import type { Photon } from '../providers/photon.js';
import type { Spacetime } from '../providers/spacetime.js';
import { checkReadiness } from '../core/readiness.js';
import { auditStorage } from '../core/storage-audit.js';
import { recallCalls } from '../core/memory.js';
import { voiceNumberId } from '../providers/voice-routing.js';
import { auth } from './auth.js';

export function api(engine: Engine, photon: Photon, spacetime: Spacetime) {
    const router = Router();
    const { config, store, gmail } = engine;

    router.use(auth(config, store));

    const owner = () => config.ALLOWED_SENDERS.split(',')[0];
    const snapshot = () => ({
        cases: store.cases().map(({ callToken: _, ...c }) => c),
        events: store.list<CaseEvent>('event').sort((a, b) => a.at - b.at),
        approvals: store.list('approval'),
        owner: owner(),
        queues: store.queueStatus(),
        services: {
            photon: photon.status,
            photonLastInboundAt: photon.lastInboundAt,
            photonDetail: photon.lastError,
            voice: config.ELEVENLABS_AGENT_ID ? 'configured' : 'not_configured',
            intake: config.ELEVENLABS_INTAKE_AGENT_ID
                ? 'configured'
                : 'not_configured',
            calling:
                config.CALLING_ENABLED === 'true' &&
                Boolean(voiceNumberId(config)),
            spacetime: spacetime.status,
            lastSyncedAt: spacetime.lastSyncedAt,
            gmail: gmail.connected(owner())
                ? 'connected'
                : gmail.configured
                  ? 'available'
                  : 'not_configured',
        },
    });

    router.get('/readiness', async (_req, res) =>
        res.json(await checkReadiness(engine, photon)),
    );
    router.get('/storage-audit', async (_req, res) =>
        res.json(await auditStorage(config, store)),
    );
    router.get('/state', (_req, res) => res.json(snapshot()));
    router.get('/events', (req, res) => {
        res.set({
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
        });
        res.flushHeaders();

        const send = () => res.write(`data: ${JSON.stringify(snapshot())}\n\n`);

        send();
        store.on('change', send);

        const heartbeat = setInterval(
            () => res.write(': heartbeat\n\n'),
            15000,
        );

        req.on('close', () => {
            clearInterval(heartbeat);
            store.off('change', send);
        });
    });
    router.post('/messages', (req, res) => {
        const { text, caseId } = z
            .object({
                text: z.string().trim().min(1).max(10000),
                caseId: z.string().optional(),
            })
            .parse(req.body);
        const id = randomUUID();

        engine.accept({
            id,
            owner: owner(),
            spaceId: `web:${owner()}`,
            text,
            caseId,
        });
        res.status(202).json({ id });
    });
    router.post('/cases/new', (_req, res) => {
        const c = store.saveCase({
            id: randomUUID(),
            owner: owner(),
            spaceId: `web:${owner()}`,
            title: 'New request',
            status: 'gathering',
            goal: '',
            business: '',
            phone: '',
            customerName: '',
            context: '',
            authorization: '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });

        res.status(201).json({ id: c.id });
    });
    router.get('/cases/:id/memory', (req, res) => {
        const c = store.case(String(req.params.id));

        if (!c) {
            res.sendStatus(404);

            return;
        }

        res.json({ memories: recallCalls(store, c) });
    });
    router.post('/cases/:id/memory', (req, res) => {
        const c = store.case(String(req.params.id));

        if (!c) {
            res.sendStatus(404);

            return;
        }

        const { excluded } = z
            .object({ excluded: z.boolean() })
            .parse(req.body);

        store.saveCase({ ...c, memoryExcluded: excluded });
        res.json({ excluded });
    });
    router.post('/cases/:id/start', async (req, res) => {
        await engine.start(String(req.params.id));
        res.json({ ok: true });
    });
    router.post('/cases/:id/stop', async (req, res) => {
        await engine.stop(String(req.params.id));
        res.json({ ok: true });
    });
    router.post('/gmail/connect', (_req, res) =>
        res.json({ url: gmail.connectionLink(owner()) }),
    );
    router.post('/gmail/disconnect', async (_req, res) => {
        await gmail.disconnect(owner());
        res.json({ ok: true });
    });
    router.post('/gmail/search', async (req, res) => {
        const { query } = z
            .object({ query: z.string().min(3).max(500) })
            .parse(req.body);

        res.json({ emails: await gmail.search(owner(), query) });
    });

    return router;
}
