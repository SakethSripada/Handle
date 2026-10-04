import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';
import { Gemini } from '../src/providers/gemini.js';
import { ElevenLabs } from '../src/providers/elevenlabs.js';
import { TextAgents } from '../src/providers/text-agents.js';
import { planSchema } from '../src/core/intake.js';

process.env.DASHBOARD_TOKEN = 'test-token-'.repeat(4);
process.env.ENCRYPTION_KEY = 'ab'.repeat(32);

const plan = {
    title: 'Opening hours',
    goal: 'Ask when the store closes',
    business: 'Store',
    phone: '+12025550110',
    customerName: '',
    context: '',
    authorization: 'Ask only',
    ready: true,
    needsEmail: false,
    reply: 'Ready.',
};

function config() {
    return {
        ...loadConfig(),
        TEXT_PROVIDER: 'auto' as const,
        GEMINI_API_KEY: 'test-gemini-key',
        GEMINI_MODEL: 'gemini-3.8-flash',
    };
}

function response(text: string, finishReason = 'STOP') {
    return {
        candidates: [
            {
                finishReason,
                content: {
                    parts: [
                        { text: 'Internal analysis', thought: true },
                        { text },
                    ],
                },
            },
        ],
    };
}

test('Gemini sends credentials in a header and validates a structured response', async (t) => {
    t.mock.method(
        globalThis,
        'fetch',
        async (url: string, init: RequestInit) => {
            assert.equal(
                url,
                'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',
            );
            assert.equal(
                new Headers(init.headers).get('x-goog-api-key'),
                'test-gemini-key',
            );

            const body = JSON.parse(String(init.body));

            assert.equal(
                body.systemInstruction.parts[0].text,
                'Trusted instructions',
            );
            assert.equal(body.contents[0].parts[0].text, 'User request');
            assert.equal(
                body.generationConfig.responseMimeType,
                'application/json',
            );
            assert.equal(
                body.generationConfig.responseJsonSchema.properties.ready.type,
                'boolean',
            );

            return Response.json(response(JSON.stringify(plan)));
        },
    );

    const actual = await new Gemini(config()).structured(
        'Trusted instructions',
        'User request',
        planSchema,
    );

    assert.deepEqual(JSON.parse(actual), plan);
});

test('truncated, blocked, empty, and malformed Gemini replies cannot authorize a call', async () => {
    for (const body of [
        response(JSON.stringify(plan), 'MAX_TOKENS'),
        { promptFeedback: { blockReason: 'SAFETY' } },
        response(''),
        response('{"ready":true}'),
        response('not JSON'),
    ]) {
        const gemini = new Gemini(config());

        gemini.request = async <T>() => body as T;
        await assert.rejects(
            () => gemini.structured('System', 'Input', planSchema),
            /complete response|invalid structured/,
        );
    }
});

test('provider errors never echo credentials or private error bodies', async (t) => {
    t.mock.method(
        globalThis,
        'fetch',
        async () =>
            new Response('test-gemini-key private input', { status: 403 }),
    );
    await assert.rejects(
        () => new Gemini(config()).structured('System', 'Input', planSchema),
        (error) => {
            assert.match((error as Error).message, /Gemini returned HTTP 403/);
            assert.doesNotMatch(
                (error as Error).message,
                /test-gemini-key|private input/,
            );

            return true;
        },
    );
});

test('auto selects direct Gemini only with a key and respects an explicit ElevenLabs choice', async () => {
    const settings = config();
    const voice = new ElevenLabs(settings);

    voice.text = async () => 'elevenlabs';

    const text = new TextAgents(settings, voice);

    assert.equal(text.provider, 'gemini');
    settings.GEMINI_API_KEY = '';
    assert.equal(text.provider, 'elevenlabs');
    assert.equal(await text.intake('Input'), 'elevenlabs');

    const explicit = new TextAgents(
        {
            ...settings,
            GEMINI_API_KEY: 'test-key',
            TEXT_PROVIDER: 'elevenlabs',
        },
        voice,
    );

    assert.equal(explicit.provider, 'elevenlabs');
});

test('direct outcome verification works without ElevenLabs text agents and never silently falls back', async () => {
    const settings = {
        ...config(),
        ELEVENLABS_INTAKE_AGENT_ID: '',
        ELEVENLABS_VERIFIER_AGENT_ID: '',
    };
    const voice = new ElevenLabs(settings);
    let fallback = 0;

    voice.text = async () => {
        fallback++;

        return 'unexpected';
    };

    const text = new TextAgents(settings, voice);

    text.gemini.request = async <T>() =>
        response(
            JSON.stringify({
                resolved: false,
                summary: 'Unconfirmed',
                confirmation: '',
                reason: 'No answer',
            }),
        ) as T;
    assert.equal(JSON.parse(await text.verify('Input')).resolved, false);
    text.gemini.request = async () => {
        throw new Error('Quota unavailable');
    };

    await assert.rejects(() => text.intake('Input'), /Quota unavailable/);
    assert.equal(fallback, 0);
});

test('a transient generation failure retries once without changing providers', async (t) => {
    let attempts = 0;

    t.mock.method(globalThis, 'fetch', async () => {
        attempts++;

        return attempts === 1
            ? new Response('Temporarily unavailable', { status: 503 })
            : Response.json(response(JSON.stringify(plan)));
    });

    const result = await new Gemini(config()).structured(
        'System',
        'Input',
        planSchema,
    );

    assert.equal(JSON.parse(result).ready, true);
    assert.equal(attempts, 2);
});

test('authentication and quota failures are not retried', async (t) => {
    let attempts = 0;

    t.mock.method(globalThis, 'fetch', async () => {
        attempts++;

        return new Response('Quota unavailable', { status: 429 });
    });
    await assert.rejects(
        () => new Gemini(config()).structured('System', 'Input', planSchema),
        /HTTP 429/,
    );
    assert.equal(attempts, 1);
});
