import express from 'express';
import { resolve } from 'node:path';
import { loadConfig } from './config.js';
import { Store } from './core/store.js';
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
const store = new Store();
const voice = new ElevenLabs(config);
const gmail = new Gmail(config, store);

const engine = new Engine(config, store, voice, gmail);
const photon = new Photon(config);
const spacetime = new Spacetime(config, store);
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

app.use('/api/settings', settings(engine));
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

void photon
    .connect((input) => engine.accept(input))
    .catch((error) => {
        photon.status = 'error';
        console.warn('Photon:', error.message);
    });

engine.resume();

let working = false;
let ticks = 0;

const timer = setInterval(async () => {
    if (working) {
        return;
    }

    working = true;

    try {
        await engine.flushMessages({
            send: async (spaceId, text, line) => {
                if (spaceId.startsWith('web:')) {
                    return;
                }

                await photon.send(spaceId, text, line);
            },
        });
        await spacetime.flush();

        if (++ticks % 5 === 0) {
            await monitor.poll();
        }
    } catch (error) {
        console.warn('Worker:', (error as Error).message);
    } finally {
        working = false;
    }
}, 1000);

for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
        clearInterval(timer);
        server.close(() => process.exit(0));
        setTimeout(() => process.exit(0), 3000).unref();
    });
}
