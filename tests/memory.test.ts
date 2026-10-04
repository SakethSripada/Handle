import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalStore as Store } from '../src/core/local-store.js';
import { recallCalls } from '../src/core/memory.js';
import type { Case } from '../src/core/model.js';

const current: Case = {
    id: 'new',
    owner: '+12025550142',
    spaceId: 'web:test',
    title: 'Refund',
    status: 'ready',
    goal: 'Check refund',
    business: 'Salon',
    phone: '+12025550110',
    customerName: 'Alex',
    context: 'New booking',
    authorization: 'No fees',
    createdAt: Date.now(),
    updatedAt: Date.now(),
};

function past(id: string, fields: Partial<Case> = {}): Case {
    return {
        ...current,
        id,
        status: 'resolved',
        confirmation: 'Business confirmed refund REF123',
        confirmedAt: Date.now(),
        outcome: 'Refund issued; allow 5 days.',
        ...fields,
    };
}

test('recall is limited to recent confirmed outcomes for this user and business', async () => {
    const store = new Store(':memory:');
    const records = [
        past('same'),
        past('other-user', { owner: 'someone-else' }),
        past('other-business', { business: 'Other Salon' }),
        past('other-phone', { phone: '+12025550112' }),
        past('rehearsal', { mode: 'rehearsal' }),
        past('unconfirmed', { confirmation: undefined }),
        past('failed', { status: 'failed' }),
        past('forgotten', { memoryExcluded: true }),
        past('old', { confirmedAt: Date.now() - 91 * 86400000 }),
        past('new'),
    ];

    await Promise.all(records.map((c) => store.saveCase(c)));

    const memory = recallCalls(store, current);

    assert.deepEqual(
        memory.map((m) => m.caseId),
        ['same'],
    );
    assert.equal('authorization' in memory[0], false);
    assert.equal('context' in memory[0], false);
    assert.deepEqual(recallCalls(store, { ...current, phone: '' }), []);
    store.db.close();
});
test('excluding memory persists in the same private SpacetimeDB case snapshot', async () => {
    const store = new Store(':memory:');

    await store.saveCase(past('previous', { callToken: 'do-not-replicate' }));
    assert.equal(recallCalls(store, current).length, 1);
    await store.saveCase({ ...store.case('previous')!, memoryExcluded: true });
    assert.equal(recallCalls(store, current).length, 0);
    assert.equal(store.case('previous')?.memoryExcluded, true);
    assert.equal(
        store.case('previous')?.confirmation,
        'Business confirmed refund REF123',
    );
    store.db.close();
});
test('recall has a bounded prompt size and orders outcomes by confirmation time', async () => {
    const store = new Store(':memory:');

    for (let i = 0; i < 6; i++) {
        await store.saveCase(
            past(`past-${i}`, { confirmedAt: Date.now() - i * 1000 }),
        );
    }

    assert.deepEqual(
        recallCalls(store, current).map((m) => m.caseId),
        ['past-0', 'past-1', 'past-2'],
    );
    store.db.close();
});
