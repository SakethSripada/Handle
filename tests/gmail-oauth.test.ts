import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import { loadConfig } from '../src/config.js';
import { LocalStore } from '../src/core/local-store.js';
import { Gmail } from '../src/providers/gmail.js';
import { gmailOAuth } from '../src/routes/gmail-oauth.js';

process.env.DASHBOARD_TOKEN = 'test-token-'.repeat(4);
process.env.ENCRYPTION_KEY = 'ab'.repeat(32);

async function setup(t: TestContext) {
    const config = {
        ...loadConfig(),
        PUBLIC_URL: 'https://handle.example',
        GOOGLE_CLIENT_ID: 'test-client',
        GOOGLE_CLIENT_SECRET: 'test-secret',
    };
    const store = new LocalStore(':memory:');
    const gmail = new Gmail(config, store);
    const app = express();

    app.use(gmailOAuth(config, gmail));

    const server = app.listen(0, '127.0.0.1');

    t.after(() => server.close());
    await once(server, 'listening');

    const address = server.address();

    assert.ok(address && typeof address !== 'string');

    const link = new URL(await gmail.connectionLink('+12025550142'));
    const url = `http://127.0.0.1:${address.port}${link.pathname}`;
    const id = link.pathname.split('/').at(-1)!;

    return { store, gmail, url, id };
}

async function form(url: string) {
    const response = await fetch(url);
    const html = await response.text();
    const csrf = html.match(/name="csrf" value="([a-f0-9]+)"/)?.[1];

    assert.ok(csrf);

    return {
        method: 'POST',
        redirect: 'manual' as const,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Cookie: response.headers.get('set-cookie')!.split(';')[0],
        },
        body: new URLSearchParams({ csrf }),
    };
}

test('HEAD and repeated messaging previews leave Gmail links usable until the user submits', async (t) => {
    const { gmail, url, id } = await setup(t);

    for (const method of ['HEAD', 'GET', 'GET']) {
        const preview = await fetch(url, { method, redirect: 'manual' });

        assert.equal(preview.status, 200);
        assert.equal(preview.headers.get('location'), null);
        assert.equal(preview.headers.get('cache-control'), 'no-store');
        await preview.text();
        assert.equal(gmail.connectionAvailable(id), true);
    }

    const submission = await form(url);
    const response = await fetch(url, submission);

    assert.equal(response.status, 303);
    assert.equal(
        new URL(response.headers.get('location')!).origin,
        'https://accounts.google.com',
    );
    assert.match(response.headers.get('set-cookie')!, /handle_oauth=/);
    assert.match(response.headers.get('set-cookie')!, /HttpOnly/);
    assert.match(response.headers.get('set-cookie')!, /Secure/);
    assert.equal(gmail.connectionAvailable(id), false);
    assert.equal((await fetch(url, submission)).status, 410);
});

test('Gmail start rejects a missing or mismatched browser form token without consuming the link', async (t) => {
    const { gmail, url, id } = await setup(t);
    const submission = await form(url);

    for (const headers of [
        { 'Content-Type': 'application/x-www-form-urlencoded' },
        { ...submission.headers, Cookie: 'handle_gmail_start=wrong-browser' },
    ]) {
        const response = await fetch(url, { ...submission, headers });

        assert.equal(response.status, 403);
        assert.equal(gmail.connectionAvailable(id), true);
    }

    assert.equal((await fetch(url, submission)).status, 303);
});

test('expired Gmail links give an actionable page and never start consent', async (t) => {
    const { store, gmail, url, id } = await setup(t);

    await store.put('connect-link', id, {
        owner: '+12025550142',
        expiresAt: Date.now() - 1,
    });

    const response = await fetch(url, { redirect: 'manual' });

    assert.equal(response.status, 410);
    assert.match(await response.text(), /connect gmail/);
    assert.equal(response.headers.get('location'), null);
    assert.equal(gmail.connectionAvailable(id), false);
});
