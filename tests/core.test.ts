import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { Store } from '../src/core/store.js';
import { Decisions } from '../src/core/decisions.js';
import { seal, unseal, verifyElevenSignature } from '../src/core/crypto.js';
import { planIntake } from '../src/core/intake.js';
import type { Case } from '../src/core/model.js';

const makeCase = (store: Store): Case =>
    store.saveCase({
        id: 'case-1',
        owner: '+12025550142',
        spaceId: 'web:test',
        title: 'Cancel appointment',
        status: 'in_call',
        goal: 'Cancel',
        business: 'Salon',
        phone: '+17345550100',
        customerName: 'Alex',
        context: 'Tomorrow at 2',
        authorization: 'Cancel only with no fee',
        createdAt: Date.now(),
        updatedAt: Date.now(),
    });

test('encrypted tokens round trip, reject tampering and the wrong key', () => {
    const key = 'ab'.repeat(32);
    const sealed = seal({ refresh_token: 'private' }, key);

    assert.deepEqual(unseal(sealed, key), { refresh_token: 'private' });
    assert.throws(() => unseal(sealed, 'cd'.repeat(32)));

    const altered = Buffer.from(sealed, 'base64');

    altered[30] ^= 1;
    assert.throws(() => unseal(altered.toString('base64'), key));
});

test('webhook verifier rejects stale, missing and altered signatures', () => {
    const body = Buffer.from('{"type":"post_call_transcription"}');
    const secret = 'test-secret';
    const now = Date.now();
    const t = String(Math.floor(now / 1000));
    const signature = createHmac('sha256', secret)
        .update(t + '.')
        .update(body)
        .digest('hex');

    assert.ok(
        verifyElevenSignature(body, `t=${t},v0=${signature}`, secret, now),
    );
    assert.equal(
        verifyElevenSignature(
            body,
            `t=${t},v0=${signature}`,
            secret,
            now + 301000,
        ),
        false,
    );
    assert.equal(
        verifyElevenSignature(
            Buffer.from('{}'),
            `t=${t},v0=${signature}`,
            secret,
            now,
        ),
        false,
    );
    assert.equal(verifyElevenSignature(body, '', '', now), false);
});

test('approvals belong to an owner, expire, and cannot be reused', () => {
    const store = new Store(':memory:');
    const c = makeCase(store);
    const sent: string[] = [];
    const decisions = new Decisions(store, (_c, text) => sent.push(text));
    const a = decisions.request(c, 'Accept a $15 cancellation fee?');

    assert.equal(decisions.request(c, 'A second question?').id, a.id);
    assert.equal(sent.length, 1);
    assert.throws(
        () => decisions.answer('+15550000000', `YES ${a.id}`),
        /does not belong/,
    );
    assert.equal(decisions.answer(c.owner, 'yes'), undefined);
    assert.equal(decisions.answer(c.owner, `NO ${a.id}`)?.status, 'declined');
    assert.throws(
        () => decisions.answer(c.owner, `YES ${a.id}`),
        /cannot authorize/,
    );

    const b = decisions.request(c, 'Accept a $20 fee?');

    store.put('approval', b.id, { ...b, expiresAt: Date.now() - 1 });
    assert.equal(decisions.get(c, b.id).status, 'expired');
    assert.throws(() => decisions.answer(c.owner, `YES ${b.id}`), /expired/);
});

test('duplicate inbound events and event IDs are idempotent', () => {
    const store = new Store(':memory:');

    assert.equal(store.receive('m1', { text: 'hello' }), true);
    assert.equal(store.receive('m1', { text: 'hello' }), false);
    store.event('c1', 'message', 'user', 'one', 'm1');
    store.event('c1', 'message', 'user', 'two', 'm1');
    assert.equal(store.events('c1').length, 1);
    assert.equal(store.events('c1')[0].text, 'one');
});

test('an in-flight replication acknowledgement cannot discard a newer state', () => {
    const store = new Store(':memory:');

    store.enqueue('replicate', { version: 1 }, 'same');

    const old = store.jobs('replicate')[0];

    store.enqueue('replicate', { version: 2 }, 'same');
    store.finishJob(old.id, old.body);
    assert.equal(store.jobs('replicate').length, 1);
    assert.match(store.jobs('replicate')[0].body, /2/);
});

test('intake cannot start a call on a malformed or incomplete model plan', async () => {
    const store = new Store(':memory:');
    const c = makeCase(store);
    const plan = {
        title: 'Test',
        goal: 'Cancel',
        business: 'Salon',
        phone: '911',
        customerName: 'Alex',
        context: 'Tomorrow',
        authorization: 'Cancel',
        ready: true,
        reply: 'Ready.',
    };
    const result = await planIntake(async () => JSON.stringify(plan), c, []);

    assert.equal(result.ready, false);
    assert.equal(result.phone, '');
    await assert.rejects(() => planIntake(async () => '{"ready":true}', c, []));
});

test('transaction rolls back partial case changes and outbox writes', () => {
    const store = new Store(':memory:');

    assert.throws(() =>
        store.transaction(() => {
            makeCase(store);
            throw new Error('rollback');
        }),
    );
    assert.equal(store.cases().length, 0);
    assert.equal(store.jobs('replicate').length, 0);
});

test('explicit call numbers are preserved without guessing between multiple destinations', async () => {
    const { explicitDialNumber, planIntake } =
        await import('../src/core/intake.js');
    const event = {
        id: 'input',
        caseId: 'phone',
        kind: 'message' as const,
        actor: 'user' as const,
        text: 'Cancel my appointment. Call 202-555-0110. No fees.',
        at: 1,
    };

    assert.equal(explicitDialNumber([event]), '+12025550110');
    assert.equal(
        explicitDialNumber([{ ...event, text: 'Do not call 202-555-0110.' }]),
        '',
    );
    assert.equal(
        explicitDialNumber([
            event,
            { ...event, text: 'That phone number was wrong.' },
        ]),
        '',
    );
    assert.equal(
        explicitDialNumber([
            { ...event, text: 'Call 202-555-0110 or call 202-555-0111.' },
        ]),
        '',
    );
    assert.equal(
        explicitDialNumber([{ ...event, text: 'Order 2025550110' }]),
        '',
    );

    const plan = await planIntake(
        async (input) => {
            assert.equal(JSON.parse(input).existingCase.phone, '+12025550110');

            return JSON.stringify({
                title: 'Cancel',
                goal: 'Cancel',
                business: 'Salon',
                phone: '',
                customerName: 'Alex',
                context: 'Tomorrow 2pm',
                authorization: 'No fees',
                ready: true,
                reply: 'Ready',
            });
        },
        {
            id: 'phone',
            owner: '+12025550142',
            spaceId: 'test',
            title: '',
            goal: '',
            business: '',
            phone: '',
            customerName: '',
            context: '',
            authorization: '',
            status: 'gathering',
            createdAt: 1,
            updatedAt: 1,
        },
        [event],
    );

    assert.equal(plan.phone, '+12025550110');
    assert.equal(plan.ready, true);
});
