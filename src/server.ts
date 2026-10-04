import express from 'express';
import { resolve } from 'node:path';
import { loadConfig } from './config.js';
import { startWorker } from './core/worker.js';
import { Engine } from './core/engine.js';
import { CallMonitor } from './core/call-monitor.js';
import { ElevenLabs } from './providers/elevenlabs.js';
import { Gmail } from './providers/gmail.js';
import { Photon } from './providers/photon.js';
import { Spacetime } from './providers/spacetime.js';
import { callbacks } from './routes/callbacks.js';
import { rehearsal } from './routes/rehearsal.js';
import { api } from './routes/api.js';
import { settings } from './routes/settings.js';
import { sessionLogin } from './routes/auth.js';

const config = loadConfig();
const store = await Spacetime.open(config);
const voice = new ElevenLabs(config);
const gmail = new Gmail(config, store);
const engine = new Engine(config, store, voice, gmail);
const photon = new Photon(config);
const spacetime = store;
const monitor = new CallMonitor(engine);
const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use((req, res, next) => {
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'X-Frame-Options': 'DENY',
        'Cache-Control': 'no-store',
    });

    if (
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
        req.headers.origin
    ) {
        const allowed = [config.PUBLIC_URL, `http://localhost:${config.PORT}`];

        if (!allowed.includes(req.headers.origin)) {
            res.status(403).json({ error: 'Origin is not allowed.' });

            return;
        }
    }

    next();
});

const callback = callbacks(engine, monitor);

app.use(callback.router);
app.use(express.json({ limit: '64kb' }));
app.get('/health', (_req, res) => res.json({ ok: true, service: 'handle' }));
app.post('/api/login', sessionLogin(config, store));
app.use('/api/cases', rehearsal(engine));
app.use('/api/settings', settings(engine, photon));
app.use('/api', api(engine, photon, spacetime));
app.use('/tools', callback.toolHandler);
app.use(express.static(resolve('dist')));
app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
app.use(
    (
        error: Error,
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction,
    ) => {
        console.error(error.name, error.message.slice(0, 300));
        res.status(error.name === 'ZodError' ? 400 : 500).json({
            error:
                error.name === 'ZodError'
                    ? 'Check the request fields.'
                    : error.message.slice(0, 300),
        });
    },
);

const server = app.listen(config.PORT, '127.0.0.1', (error?: Error) => {
    if (error) {
        console.error(error);
        process.exit(1);
    }

    console.log(
        `Handle listening on http://localhost:${config.PORT}; calls ${config.CALLING_ENABLED === 'true' ? 'enabled' : 'paused'}`,
    );
});

photon.lastInboundAt = store
    .cases()
    .filter((c) => !c.spaceId.startsWith('web:'))
    .flatMap((c) => store.events(c.id))
    .filter((event) => event.kind === 'message' && event.actor === 'user')
    .reduce<number | undefined>(
        (latest, event) => Math.max(latest ?? 0, event.at),
        undefined,
    );
void photon
    .connect(async (input) => await engine.accept(input))
    .catch((error) => {
        photon.status = 'error';
        console.warn('Photon:', error.message);
    });
engine.resume();
store.on('online', () => engine.resume());

const stopWorkers = [
    startWorker('Inbox', 2000, async () => {
        store.assertAvailable();
        engine.resume();
    }),
    startWorker('Messages', 1000, () =>
        engine.flushMessages({
            send: async (spaceId, text, line) => {
                if (!spaceId.startsWith('web:')) {
                    await photon.send(spaceId, text, line);
                }
            },
        }),
    ),
    startWorker('Call status', 5000, () => monitor.poll()),
];

for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
        stopWorkers.forEach((stop) => stop());
        void (async () => {
            await photon.stop();
            await store.close();
            server.closeAllConnections();
            server.close(() => process.exit(0));
        })().catch(() => process.exit(1));
        setTimeout(() => process.exit(0), 3000).unref();
    });
}
