import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/core/store.js';
import { Engine } from '../src/core/engine.js';
import { VoiceTools } from '../src/core/voice-tools.js';
import { CallMonitor } from '../src/core/call-monitor.js';
import { loadConfig } from '../src/config.js';
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
    const gmail = new Gmail(config, store);

    return { store, voice, engine: new Engine(config, store, voice, gmail) };
}

test('a real request reaches ready without dialing while calling is paused', async () => {
    const { store, voice, engine } = setup();
    let dials = 0;

    voice.text = async () =>
        JSON.stringify({
            title: 'Cancel appointment',
            goal: 'Cancel',
            business: 'Salon',
            phone: '7345550100',
            customerName: 'Alex',
            context: 'Tomorrow 2pm',
            authorization: 'No fees',
            ready: true,
            reply: 'Ready',
        });
    voice.startCall = async () => {
        dials++;
        throw new Error('Should not dial');
    };

    engine.accept({
        id: 'm1',
        owner: '+12025550142',
        spaceId: 'web:test',
        text: 'Cancel my appointment',
    });
    await engine.idle();
    assert.equal(store.cases()[0].status, 'ready');
    assert.equal(dials, 0);
    await assert.rejects(() => engine.start(store.cases()[0].id), /paused/);
    engine.accept({
        id: 'm1',
        owner: '+12025550142',
        spaceId: 'web:test',
        text: 'Cancel my appointment',
    });
    await engine.idle();
    assert.equal(store.cases().length, 1);
    assert.throws(
        () =>
            engine.accept({
                id: 'm2',
                owner: 'stranger',
                spaceId: 'x',
                text: 'Call someone',
            }),
        /not enrolled/,
    );
});

test('resolution needs confirmation and cannot bypass pending approval', async () => {
    const { store, engine } = setup();
    const c = store.saveCase({
        id: 'c',
        owner: '+12025550142',
        spaceId: 'web:test',
        title: 'Cancel',
        status: 'in_call',
        goal: 'Cancel',
        business: 'Salon',
        phone: '+17345550100',
        customerName: 'Alex',
        context: 'Tomorrow',
        authorization: 'No fees',
        createdAt: Date.now(),
        updatedAt: Date.now(),
    });
    const tools = new VoiceTools(engine);

    await assert.rejects(
        () =>
            tools.run(c, 'finish_case', {
                status: 'resolved',
                summary: 'Done',
                confirmation: '',
            }),
        /explicit confirmation/,
    );

    const decision = engine.decisions.request(c, 'Pay $15?');

    await assert.rejects(
        () =>
            tools.run(c, 'finish_case', {
                status: 'resolved',
                summary: 'Done',
                confirmation: 'ref 123',
            }),
        /unresolved decision/,
    );
    engine.decisions.answer(c.owner, `NO ${decision.id}`);
    await tools.run(store.case(c.id)!, 'finish_case', {
        status: 'resolved',
        summary: 'They waived the fee and cancelled.',
        confirmation: 'ref 123',
    });
    assert.equal(store.case(c.id)?.status, 'resolved');
    assert.equal(store.jobs('message').length, 3);
});

test('a disconnected call is not treated as a successful resolution', () => {
    const { store, engine } = setup();

    store.saveCase({
        id: 'c',
        owner: '+12025550142',
        spaceId: 'web:test',
        title: 'Cancel',
        status: 'in_call',
        goal: 'Cancel',
        business: 'Salon',
        phone: '+17345550100',
        customerName: 'Alex',
        context: 'Tomorrow',
        authorization: 'No fees',
        conversationId: 'conv-1',
        callToken: 'secret',
        createdAt: Date.now(),
        updatedAt: Date.now(),
    });
    new CallMonitor(engine).apply('c', {
        conversation_id: 'conv-1',
        status: 'done',
        analysis: {
            call_successful: 'success',
            transcript_summary: 'The representative offered to look into it.',
        },
        transcript: [{ role: 'user', message: 'I will look into that.' }],
    });
    assert.equal(store.case('c')?.status, 'follow_up');
    assert.equal(store.case('c')?.callToken, undefined);
    assert.equal(
        store.events('c').filter((e) => e.kind === 'transcript').length,
        1,
    );
});

test('a late approval cannot revive a call that already ended', () => {
    const { store, engine } = setup();
    const c = store.saveCase({
        id: 'closed',
        owner: '+12025550142',
        spaceId: 'web:test',
        title: 'Cancel',
        status: 'in_call',
        goal: 'Cancel',
        business: 'Salon',
        phone: '+17345550100',
        customerName: 'Alex',
        context: 'Tomorrow',
        authorization: 'No fees',
        createdAt: Date.now(),
        updatedAt: Date.now(),
    });
    const decision = engine.decisions.request(c, 'Pay $25?');

    store.saveCase({ ...store.case(c.id)!, status: 'follow_up' });
    assert.throws(
        () => engine.decisions.answer(c.owner, `YES ${decision.id}`),
        /call has ended/,
    );
    assert.equal(store.case(c.id)?.status, 'follow_up');
});

test('post-call transcript does not duplicate a browser transcript', () => {
    const { store, engine } = setup();

    store.saveCase({
        id: 'browser',
        mode: 'rehearsal',
        owner: '+12025550142',
        spaceId: 'web:test',
        title: 'Rehearsal',
        status: 'resolved',
        goal: 'Cancel',
        business: 'Salon',
        phone: '+17345550100',
        customerName: 'Alex',
        context: 'Tomorrow',
        authorization: 'No fees',
        conversationId: 'conv-browser',
        createdAt: Date.now(),
        updatedAt: Date.now(),
    });
    store.event(
        'browser',
        'transcript',
        'business',
        'It is cancelled.',
        'browser:browser:1',
    );
    new CallMonitor(engine).apply('browser', {
        conversation_id: 'conv-browser',
        status: 'done',
        transcript: [{ role: 'user', message: 'It is cancelled.' }],
    });
    assert.equal(
        store.events('browser').filter((e) => e.kind === 'transcript').length,
        1,
    );
});

test('Gmail can supply missing evidence without authorizing a new action', async () => {
    const { store, voice, engine } = setup();

    engine.gmail.connected = () => true;
    engine.gmail.search = async (_owner, query) => {
        assert.match(query, /Maple/);

        return [
            {
                id: 'receipt',
                subject: 'Appointment',
                from: 'salon@example.test',
                date: 'Tomorrow',
                body: 'Alex, your appointment is tomorrow at 2pm.',
                url: 'https://mail.google.com/',
            },
        ];
    };

    const inputs: any[] = [];

    voice.text = async (input) => {
        const data = JSON.parse(input);

        inputs.push(data);

        return JSON.stringify({
            title: 'Cancel appointment',
            goal: 'Cancel',
            business: 'Maple',
            phone: '7345550100',
            customerName: 'Alex',
            context: data.emailEvidence.length ? 'Tomorrow at 2pm' : '',
            authorization: 'No fees',
            ready: !!data.emailEvidence.length,
            reply: 'What time is the appointment?',
        });
    };

    engine.accept({
        id: 'mail-intake',
        owner: '+12025550142',
        spaceId: 'web:test',
        text: 'Cancel my appointment at Maple. No fees.',
    });
    await engine.idle();
    assert.equal(inputs.length, 2);
    assert.equal(inputs[1].emailEvidence[0].id, 'receipt');
    assert.equal(store.cases()[0].status, 'ready');
    assert.equal(store.cases()[0].authorization, 'No fees');
    assert.equal(
        store.events(store.cases()[0].id).filter((e) => e.kind === 'email')
            .length,
        1,
    );
});

test('the first iMessage cannot reuse a workspace rehearsal or web request', async () => {
    const { store, voice, engine } = setup();

    voice.text = async () =>
        JSON.stringify({
            title: 'Cancel appointment',
            goal: 'Cancel',
            business: 'Salon',
            phone: '2025550110',
            customerName: 'Alex',
            context: 'Tomorrow at 2pm',
            authorization: 'No fees',
            ready: true,
            reply: 'Ready',
        });
    engine.accept({
        id: 'web-first',
        owner: '+12025550142',
        spaceId: 'web:test',
        text: 'Cancel my appointment',
    });
    await engine.idle();
    engine.accept({
        id: 'imessage-first',
        owner: '+12025550142',
        spaceId: 'imessage:test',
        text: 'Cancel my appointment',
    });
    await engine.idle();
    assert.equal(store.cases().length, 2);

    const phoneCase = store.cases().find((c) => c.spaceId === 'imessage:test')!;

    assert.equal(phoneCase.status, 'ready');
    assert.ok(
        store
            .jobs('message')
            .some((job) => JSON.parse(job.body).spaceId === 'imessage:test'),
    );
});

test('concurrent start requests cannot dial the same case twice', async () => {
    const { store, voice, engine } = setup();

    engine.config.CALLING_ENABLED = 'true';
    store.saveCase({
        id: 'one-call',
        owner: '+12025550142',
        spaceId: 'web:test',
        title: 'Cancel',
        status: 'ready',
        goal: 'Cancel',
        business: 'Salon',
        phone: '+12025550110',
        customerName: 'Alex',
        context: 'Tomorrow',
        authorization: 'No fees',
        createdAt: Date.now(),
        updatedAt: Date.now(),
    });

    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });

    engine.telephony.validateDestination = async () => gate;

    let dials = 0;

    voice.startCall = async () => {
        dials++;

        return {
            success: true,
            message: 'Started',
            conversation_id: 'test-conversation',
            callSid: 'test-call',
        };
    };

    const first = engine.start('one-call');
    const second = engine.start('one-call');

    release();

    const results = await Promise.allSettled([first, second]);

    assert.equal(dials, 1);
    assert.equal(
        results.filter((result) => result.status === 'fulfilled').length,
        1,
    );
});
