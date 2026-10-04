import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { LocalStore as Store } from '../src/core/local-store.js';
import { Decisions } from '../src/core/decisions.js';
import { seal, unseal, verifyElevenSignature } from '../src/core/crypto.js';
import { planIntake } from '../src/core/intake.js';
import type { Case } from '../src/core/model.js';

const makeCase = async (store: Store): Promise<Case> =>
    await store.saveCase({
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

test('encrypted tokens round trip, reject tampering and the wrong key', async () => {
    const key = 'ab'.repeat(32);
    const sealed = seal({ refresh_token: 'private' }, key);

    assert.deepEqual(unseal(sealed, key), { refresh_token: 'private' });
    assert.throws(() => unseal(sealed, 'cd'.repeat(32)));

    const altered = Buffer.from(sealed, 'base64');

    altered[30] ^= 1;
    assert.throws(() => unseal(altered.toString('base64'), key));
});
test('webhook verifier rejects stale, missing and altered signatures', async () => {
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
test('approvals belong to an owner, expire, and cannot be reused', async () => {
    const store = new Store(':memory:');
    const c = await makeCase(store);
    const sent: string[] = [];
    const decisions = new Decisions(store, (_c, text) => sent.push(text));
    const a = await decisions.request(c, 'Accept a $15 cancellation fee?');

    assert.equal((await decisions.request(c, 'A second question?')).id, a.id);
    assert.equal(sent.length, 1);
    await assert.rejects(
        async () => await decisions.answer('+15550000000', `YES ${a.id}`),
        /does not belong/,
    );
    assert.equal(await decisions.answer(c.owner, 'yes'), undefined);
    assert.equal(
        (await decisions.answer(c.owner, `NO ${a.id}`))?.status,
        'declined',
    );
    await assert.rejects(
        async () => await decisions.answer(c.owner, `YES ${a.id}`),
        /cannot authorize/,
    );

    const b = await decisions.request(c, 'Accept a $20 fee?');

    await store.put('approval', b.id, { ...b, expiresAt: Date.now() - 1 });
    assert.equal((await decisions.get(c, b.id)).status, 'expired');
    await assert.rejects(
        async () => await decisions.answer(c.owner, `YES ${b.id}`),
        /expired/,
    );
});
test('duplicate inbound events and event IDs are idempotent', async () => {
    const store = new Store(':memory:');

    assert.equal(await store.receive('m1', { text: 'hello' }), true);
    assert.equal(await store.receive('m1', { text: 'hello' }), false);
    await store.event('c1', 'message', 'user', 'one', 'm1');
    await store.event('c1', 'message', 'user', 'two', 'm1');
    assert.equal(store.events('c1').length, 1);
    assert.equal(store.events('c1')[0].text, 'one');
});
test('an in-flight replication acknowledgement cannot discard a newer state', async () => {
    const store = new Store(':memory:');

    await store.enqueue('replicate', { version: 1 }, 'same');

    const old = store.jobs('replicate')[0];

    await store.enqueue('replicate', { version: 2 }, 'same');
    await store.finishJob(old.id, old.body);
    assert.equal(store.jobs('replicate').length, 1);
    assert.match(store.jobs('replicate')[0].body, /2/);
});
test('intake cannot start a call on a malformed or incomplete model plan', async () => {
    const store = new Store(':memory:');
    const c = await makeCase(store);
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
test('transaction rolls back partial case changes and outbox writes', async () => {
    const store = new Store(':memory:');

    await assert.rejects(
        async () =>
            await store.transaction(async () => {
                await makeCase(store);
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
test('an information request can be ready without a name or account details', async () => {
    const c = await makeCase(new Store(':memory:'));
    const result = await planIntake(
        async () =>
            JSON.stringify({
                title: 'Check opening hours',
                goal: 'Ask what time the store closes today',
                business: 'Hardware store',
                phone: '+12025550110',
                customerName: '',
                context: '',
                authorization: 'Ask about hours only; make no changes',
                ready: true,
                needsEmail: false,
                reply: 'I have what I need.',
            }),
        c,
        [],
    );

    assert.equal(result.ready, true);
    assert.equal(result.customerName, '');
    assert.equal(result.context, '');
    assert.equal(result.needsEmail, false);
});
test('task-specific missing details still prevent dialing', async () => {
    const c = await makeCase(new Store(':memory:'));
    const result = await planIntake(
        async () =>
            JSON.stringify({
                title: 'Track delivery',
                goal: 'Find out when the package will arrive',
                business: 'Courier',
                phone: '+12025550110',
                customerName: 'Alex',
                context: '',
                authorization: 'Ask about delivery only',
                ready: false,
                reply: 'What is the tracking number?',
            }),
        c,
        [],
    );

    assert.equal(result.ready, false);
    assert.equal(result.needsEmail, false);
});
