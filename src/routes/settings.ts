import type { Photon } from '../providers/photon.js';
import { checkReadiness } from '../core/readiness.js';
import { Router } from 'express';
import { z } from 'zod';
import type { Engine } from '../core/engine.js';
import { saveEnv } from '../config-file.js';
import { auth } from './auth.js';

const credentialSchema = z
    .object({
        PHOTON_PROJECT_SECRET: z.string().trim().min(16).max(512).optional(),
        TWILIO_ACCOUNT_SID: z
            .string()
            .regex(/^AC[a-f0-9]{32}$/i)
            .optional(),
        TWILIO_AUTH_TOKEN: z
            .string()
            .regex(/^[a-f0-9]{32}$/i)
            .optional(),
    })
    .strict();

export function settings(engine: Engine, photon: Photon) {
    const router = Router();

    router.use(auth(engine.config, engine.store));
    router.post('/credentials', (req, res) => {
        const localHosts = [
            `localhost:${engine.config.PORT}`,
            `127.0.0.1:${engine.config.PORT}`,
        ];

        if (
            !localHosts.includes(req.get('host') ?? '') ||
            req.get('x-forwarded-for') ||
            req.get('cf-connecting-ip')
        ) {
            res.status(403).json({
                error: 'Save service credentials from the local Handle workspace.',
            });

            return;
        }

        const values = credentialSchema.parse(req.body);

        saveEnv(values);
        Object.assign(engine.config, values);
        engine.store.emit('change');
        res.json({ saved: true });
    });
    router.post('/calling', async (req, res) => {
        const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);

        if (
            enabled &&
            !(await checkReadiness(engine, photon)).canEnableCalling
        ) {
            res.status(409).json({
                error: 'Finish the phone and voice connection steps before enabling calls.',
            });

            return;
        }

        const value = enabled ? 'true' : 'false';

        saveEnv({ CALLING_ENABLED: value });
        engine.config.CALLING_ENABLED = value;
        engine.store.emit('change');
        res.json({ enabled });
    });

    return router;
}
