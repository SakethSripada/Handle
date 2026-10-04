import type { RequestHandler, Request } from 'express';
import { equal, token } from '../core/crypto.js';
import type { Config } from '../config.js';
import type { Store } from '../core/store.js';

export function cookie(req: Request, name: string) {
    return (
        req.headers.cookie
            ?.split(';')
            .map((v) => v.trim())
            .find((v) => v.startsWith(`${name}=`))
            ?.slice(name.length + 1) ?? ''
    );
}

export function auth(config: Config, store: Store): RequestHandler {
    return (req, res, next) => {
        const bearer = req.headers.authorization?.replace(/^Bearer /, '') ?? '';
        const session = store.get<{
            expiresAt: number;
        }>('session', cookie(req, 'handle_session'));

        if (
            equal(bearer, config.DASHBOARD_TOKEN) ||
            (session && session.expiresAt > Date.now())
        ) {
            return next();
        }

        res.status(401).json({ error: 'Sign in to Handle.' });
    };
}

export function sessionLogin(config: Config, store: Store): RequestHandler {
    const attempts = new Map<
        string,
        {
            count: number;
            reset: number;
        }
    >();

    return async (req, res) => {
        const ip = req.ip ?? 'unknown';
        const entry = attempts.get(ip) ?? {
            count: 0,
            reset: Date.now() + 60000,
        };

        if (entry.reset < Date.now()) {
            entry.count = 0;
            entry.reset = Date.now() + 60000;
        }

        entry.count++;
        attempts.set(ip, entry);

        if (entry.count > 10) {
            res.status(429).json({
                error: 'Too many attempts. Try again in a minute.',
            });

            return;
        }

        if (
            typeof req.body.token !== 'string' ||
            !equal(req.body.token, config.DASHBOARD_TOKEN)
        ) {
            res.status(401).json({ error: 'Incorrect access key.' });

            return;
        }

        const id = token();

        await store.put('session', id, { expiresAt: Date.now() + 86400000 });
        res.cookie('handle_session', id, {
            httpOnly: true,
            sameSite: 'strict',
            secure: req.secure,
            maxAge: 86400000,
        });
        res.json({ ok: true });
    };
}
