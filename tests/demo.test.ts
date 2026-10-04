import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';
import { LocalStore as Store } from '../src/core/local-store.js';
import { Engine } from '../src/core/engine.js';
import { VoiceTools } from '../src/core/voice-tools.js';
import { CallMonitor } from '../src/core/call-monitor.js';
import { callVariables, demoCommand } from '../src/core/demo.js';
import { recallCalls } from '../src/core/memory.js';
import { ElevenLabs } from '../src/providers/elevenlabs.js';
import { Gmail } from '../src/providers/gmail.js';

process.env.DASHBOARD_TOKEN = 'test-token-'.repeat(4);
process.env.ENCRYPTION_KEY = 'ab'.repeat(32);
process.env.ALLOWED_SENDERS = '+12025550142';
process.env.CALLING_ENABLED = 'false';

function setup() {
    const config = loadConfig();
    const store = new Store(':memory:');
    const voice = new ElevenLabs(config);
    const engine = new Engine(config, store, voice, new Gmail(config, store));

    voice.text = async () => {
        throw new Error('Demo must bypass intake');
    };

    voice.startCall = async () => {
        throw new Error('Calling is paused');
    };

    return { engine, store, voice };
}

const input = {
    id: 'demo-message',
    owner: '+12025550142',
    spaceId: 'imessage:test',
    text: 'Demo call (202) 555-0110',
};

test('demo command accepts one explicit number and rejects ambiguous instructions', async () => {
    assert.equal(demoCommand(input.text)?.phone, '+12025550110');
    assert.equal(
        demoCommand('Demo call +44 20 7946 0018')?.phone,
        '+442079460018',
    );
    assert.equal(demoCommand('Demo call 2025550110 or 2025550111')?.phone, '');
    assert.equal(demoCommand('Demo call 911')?.phone, '');
    assert.equal(demoCommand('Could you explain demo calling?'), undefined);
});
test('demo intake needs no LLM or email and duplicate delivery creates one request', async () => {
    const { engine, store } = setup();

    await engine.accept(input);
    await engine.accept(input);
    await engine.idle();

    const c = store.cases()[0];

    assert.equal(store.cases().length, 1);
    assert.equal(c.mode, 'demo');
    assert.equal(c.status, 'ready');
    assert.equal(c.phone, '+12025550110');
    assert.equal(c.memoryExcluded, true);
    assert.match(JSON.parse(store.jobs('message')[0].body).text, /paused/);
    assert.match(callVariables(c).opening_message, /AI assistant/);
    assert.match(callVariables(c).opening_message, /enjoying MHacks/);
    assert.equal(JSON.parse(callVariables(c).case_context).mode, 'demo');
});
test('a new demo does not overwrite a prepared customer-service request', async () => {
    const { engine, store } = setup();

    await engine.accept(input);
    await engine.idle();

    const first = store.cases()[0];

    await store.saveCase({
        ...first,
        mode: undefined,
        title: 'Cancel appointment',
        context: 'Private reservation',
    });
    await engine.accept({ ...input, id: 'second' });
    await engine.idle();
    assert.equal(store.cases().length, 2);
    assert.equal(store.case(first.id)?.title, 'Cancel appointment');
    assert.ok(
        !JSON.stringify(store.cases().find((c) => c.mode === 'demo')).includes(
            'Private reservation',
        ),
    );
});
test('a demo cannot start a second call while the current call is live', async () => {
    const { engine, store } = setup();

    await engine.accept(input);
    await engine.idle();

    const c = store.cases()[0];

    await store.saveCase({
        ...c,
        status: 'in_call',
        context: 'Original context',
    });
    await engine.accept({
        ...input,
        id: 'another-demo',
        text: 'Demo call 2025550112',
    });
    await engine.idle();
    assert.equal(store.cases().length, 1);
    assert.equal(store.case(c.id)?.phone, '+12025550110');
    assert.equal(store.case(c.id)?.context, 'Original context');
    assert.ok(store.events(c.id).some((e) => /already a call/.test(e.text)));
});
test('demo tools cannot access private evidence, approvals, or report a real resolution', async () => {
    const { engine, store } = setup();

    await engine.accept(input);
    await engine.idle();

    const c = store.cases()[0];
    const tools = new VoiceTools(engine);
    let searches = 0;

    engine.gmail.search = async () => {
        searches++;

        return [];
    };

    engine.gmail.connected = () => true;

    for (const name of [
        'search_email',
        'request_decision',
        'get_decision',
        'finish_case',
    ]) {
        assert.equal(
            (
                (await tools.run(c, name, {})) as {
                    allowed: boolean;
                }
            ).allowed,
            false,
        );
    }

    const context = (await tools.run(c, 'get_case_context', {})) as Record<
        string,
        unknown
    >;

    assert.equal(context.gmailConnected, false);
    assert.deepEqual(context.pastCalls, []);
    assert.equal(searches, 0);
    assert.equal(store.approvals(c.id).length, 0);
    assert.equal(store.case(c.id)?.status, 'ready');
});
test('demo finalization records a conversation once without claiming a business resolution', async () => {
    const { engine, store } = setup();

    await engine.accept(input);
    await engine.idle();

    const c = store.cases()[0];

    await store.saveCase({
        ...c,
        status: 'in_call',
        conversationId: 'demo-conversation',
        callToken: 'temporary',
    });

    const monitor = new CallMonitor(engine);
    const data = {
        conversation_id: 'demo-conversation',
        status: 'done',
        transcript: [
            { role: 'agent', message: 'Hello.' },
            { role: 'user', message: 'Tell me about Handle.' },
        ],
    };

    await Promise.all([monitor.apply(c.id, data), monitor.apply(c.id, data)]);

    const done = store.case(c.id)!;

    assert.equal(done.status, 'completed');
    assert.equal(done.confirmedAt, undefined);
    assert.equal(done.callToken, undefined);
    assert.equal(
        store.events(c.id).filter((e) => e.id === `out:result:${c.id}`).length,
        1,
    );
    assert.deepEqual(
        recallCalls(store, { ...done, id: 'new', mode: undefined }),
        [],
    );
});
test('an unanswered demo cannot be reported as a completed conversation', async () => {
    const { engine, store } = setup();

    await engine.accept(input);
    await engine.idle();

    const c = store.cases()[0];

    await store.saveCase({
        ...c,
        status: 'dialing',
        conversationId: 'no-answer',
    });
    await new CallMonitor(engine).apply(c.id, {
        conversation_id: 'no-answer',
        status: 'done',
        transcript: [],
    });
    assert.equal(store.case(c.id)?.status, 'failed');
    assert.match(
        store.case(c.id)?.outcome ?? '',
        /without a confirmed conversation/,
    );
});
test('a SIP demo honors stop before exposing context and confirms observed hangup', async () => {
    const { engine, store } = setup();

    await engine.accept(input);
    await engine.idle();

    const c = store.cases()[0];

    await store.saveCase({
        ...c,
        status: 'in_call',
        voiceProvider: 'photon',
        conversationId: 'stop-demo',
    });
    await engine.stop(c.id);

    const result = (await new VoiceTools(engine).run(
        c,
        'get_case_context',
        {},
    )) as {
        stop_requested: boolean;
    };

    assert.equal(result.stop_requested, true);
    await new CallMonitor(engine).apply(c.id, {
        conversation_id: 'stop-demo',
        status: 'done',
    });
    assert.equal(store.case(c.id)?.status, 'cancelled');
});
test('a ready demo cannot bypass an existing call through the dashboard', async () => {
    const { engine, store } = setup();

    await engine.accept(input);
    await engine.idle();

    const c = store.cases()[0];

    await store.saveCase({
        ...c,
        id: 'other-call',
        spaceId: 'web:test',
        status: 'in_call',
    });
    engine.config.CALLING_ENABLED = 'true';
    await assert.rejects(() => engine.start(c.id), /Finish the current call/);
    assert.equal(store.case(c.id)?.status, 'ready');
});
test('replaying the inbox after a restart cannot redial a completed demo', async () => {
    const { engine, store } = setup();

    await engine.accept(input);
    await engine.idle();

    const c = store.cases()[0];

    await store.saveCase({
        ...c,
        status: 'completed',
        outcome: 'Demo finished.',
    });
    await store.put('inbox', input.id, {
        ...store.get<object>('inbox', input.id),
        done: false,
    });
    engine.config.CALLING_ENABLED = 'true';
    engine.config.ELEVENLABS_PHONE_NUMBER_ID = 'test-number';
    engine.resume();
    await engine.idle();
    assert.equal(store.cases().length, 1);
    assert.equal(store.case(c.id)?.status, 'completed');
    assert.equal(store.case(c.id)?.outcome, 'Demo finished.');
});
test('an enabled voice route starts a demo once from a duplicated text', async () => {
    const { engine, store, voice } = setup();

    Object.assign(engine.config, {
        CALLING_ENABLED: 'true',
        VOICE_PROVIDER: 'twilio',
        ELEVENLABS_PHONE_NUMBER_ID: 'test-number',
        TWILIO_PHONE_NUMBER: '+12025550111',
    });
    engine.telephony.validateDestination = async () => {};

    engine.telephony.checkUsCalling = async () => {};

    voice.request = async <T>() =>
        ({
            provider: 'twilio',
            phone_number: engine.config.TWILIO_PHONE_NUMBER,
            assigned_agent: { agent_id: engine.config.ELEVENLABS_AGENT_ID },
        }) as T;

    let dials = 0;

    voice.startCall = async (c) => {
        dials++;
        assert.equal(c.mode, 'demo');
        assert.equal(c.phone, '+12025550110');
        assert.ok(c.callToken);

        return {
            success: true,
            message: 'Started',
            conversation_id: 'demo-start',
            callSid: 'test-call',
        };
    };

    await engine.accept(input);
    await engine.accept(input);
    await engine.idle();
    assert.equal(dials, 1);
    assert.equal(store.cases()[0].status, 'dialing');
    assert.equal(store.cases()[0].conversationId, 'demo-start');
});

test('an unanswered carrier call finalizes even before ElevenLabs has a transcript', async () => {
    const { engine, store, voice } = setup();

    await engine.accept(input);
    await engine.idle();

    const c = store.cases()[0];

    await store.saveCase({
        ...c,
        status: 'in_call',
        voiceProvider: 'twilio',
        callSid: 'unanswered-call',
        conversationId: 'unanswered-conversation',
        callToken: 'temporary',
    });
    engine.telephony.callStatus = async () => 'no-answer';
    voice.conversation = async () => {
        throw new Error('No conversation was established');
    };

    const monitor = new CallMonitor(engine);

    await monitor.poll();
    await monitor.poll();
    assert.equal(store.case(c.id)?.status, 'failed');
    assert.equal(store.case(c.id)?.callToken, undefined);
    assert.equal(
        store.events(c.id).filter((e) => e.id === `out:result:${c.id}`).length,
        1,
    );
});
