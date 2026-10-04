import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyOutcome } from '../src/core/outcome-verification.js';
import { Store } from '../src/core/store.js';
import { loadConfig } from '../src/config.js';
import { Engine } from '../src/core/engine.js';
import { CallMonitor } from '../src/core/call-monitor.js';
import { ElevenLabs } from '../src/providers/elevenlabs.js';
import { Gmail } from '../src/providers/gmail.js';
import type { Case } from '../src/core/model.js';

process.env.DASHBOARD_TOKEN = 'test-token-'.repeat(4);
process.env.ENCRYPTION_KEY = 'ab'.repeat(32);

const c: Case = {
    id: 'verify',
    owner: '+12025550142',
    spaceId: 'web:test',
    title: 'Cancel',
    status: 'in_call',
    goal: 'Cancel',
    business: 'Salon',
    phone: '+12025550110',
    customerName: 'Alex',
    context: 'Tomorrow',
    authorization: 'No fees',
    createdAt: 1,
    updatedAt: 1,
    conversationId: 'conversation',
    callToken: 'secret',
    proposedOutcome: { summary: 'Cancelled', confirmation: 'C123' },
};

test('a verifier cannot ground completion in the assistant or an invented business quote', async () => {
    const result = await verifyOutcome(
        async () =>
            JSON.stringify({
                resolved: true,
                summary: 'Cancelled',
                confirmation: 'The appointment is cancelled.',
                reason: '',
            }),
        c,
        [
            { role: 'agent', message: 'The appointment is cancelled.' },
            { role: 'user', message: 'I can cancel it for you.' },
        ],
        [],
    );

    assert.equal(result.resolved, false);
});

test('the customer only gets Handled after independent verification of the completed transcript', async () => {
    const config = loadConfig();

    config.ELEVENLABS_VERIFIER_AGENT_ID = 'verifier';

    const store = new Store(':memory:');
    const voice = new ElevenLabs(config);
    const engine = new Engine(config, store, voice, new Gmail(config, store));

    store.saveCase(c);

    let release!: () => void;
    const wait = new Promise<void>((resolve) => {
        release = resolve;
    });

    voice.text = async (prompt, agent) => {
        assert.equal(agent, 'verifier');
        assert.equal(JSON.parse(prompt).transcript[0].speaker, 'business');
        await wait;

        return JSON.stringify({
            resolved: true,
            summary: 'Appointment cancelled without fees.',
            confirmation: 'I have cancelled it. Confirmation C123.',
            reason: '',
        });
    };

    const monitor = new CallMonitor(engine);
    const task = monitor.apply(c.id, {
        conversation_id: 'conversation',
        status: 'done',
        transcript: [
            {
                role: 'user',
                message: 'I have cancelled it. Confirmation C123.',
            },
        ],
    });

    assert.equal(store.case(c.id)?.status, 'verifying');
    assert.equal(store.jobs('message').length, 0);
    assert.equal(store.case(c.id)?.callToken, undefined);
    release();
    await task;
    assert.equal(store.case(c.id)?.status, 'resolved');
    assert.ok(store.case(c.id)?.confirmedAt);
    assert.match(JSON.parse(store.jobs('message')[0].body).text, /^Handled/);
    await monitor.apply(c.id, {
        conversation_id: 'conversation',
        status: 'done',
    });
    assert.equal(store.jobs('message').length, 1);
    store.db.close();
});

test('verification outages leave a follow-up without creating recallable success', async () => {
    const config = loadConfig();

    config.ELEVENLABS_VERIFIER_AGENT_ID = 'verifier';

    const store = new Store(':memory:');
    const voice = new ElevenLabs(config);

    voice.text = async () => {
        throw new Error('Network unavailable');
    };

    const engine = new Engine(config, store, voice, new Gmail(config, store));

    store.saveCase(c);
    await new CallMonitor(engine).apply(c.id, {
        conversation_id: 'conversation',
        status: 'done',
    });
    assert.equal(store.case(c.id)?.status, 'follow_up');
    assert.equal(store.case(c.id)?.confirmedAt, undefined);
    store.db.close();
});
