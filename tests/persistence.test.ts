import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/core/store.js';
import type { Case } from '../src/core/model.js';

const c: Case = {
    id: 'persisted',
    owner: '+12025550142',
    spaceId: 'imessage:test',
    title: 'Cancel',
    status: 'resolved',
    goal: 'Cancel',
    business: 'Salon',
    phone: '+12025550110',
    customerName: 'Alex',
    context: 'Tomorrow',
    authorization: 'No fees',
    createdAt: 1,
    updatedAt: 1,
    confirmation: 'C123',
    confirmedAt: Date.now(),
    outcome: 'Cancelled without a fee',
    callToken: 'never-replicate',
};

test('case memory, transcript and pending delivery survive a process restart', () => {
    const directory = mkdtempSync(join(tmpdir(), 'handle-test-'));
    const path = join(directory, 'handle.sqlite');
    let store = new Store(path);

    try {
        store.saveCase(c);
        store.event(
            c.id,
            'transcript',
            'business',
            'Cancellation C123 is complete.',
            'line-1',
        );
        store.enqueue(
            'message',
            { spaceId: c.spaceId, text: 'Handled.' },
            'reply',
        );
        store.retryJob('reply', 0);
        store.db.close();
        store = new Store(path);
        assert.equal(store.case(c.id)?.confirmation, 'C123');
        assert.equal(store.events(c.id).length, 1);
        assert.equal(store.queueStatus().messages.pending, 1);
        assert.equal(store.queueStatus().messages.retrying, 1);
        assert.equal(store.queueStatus().replication.pending, 2);
        assert.equal(
            JSON.parse(store.jobs('replicate')[0].body).data.callToken,
            undefined,
        );
    } finally {
        store.db.close();
        rmSync(directory, { recursive: true, force: true });
    }
});

test('a completed cloud write cannot discard a newer queued case update', () => {
    const store = new Store(':memory:');

    store.saveCase(c);

    const old = store.jobs('replicate')[0];

    store.saveCase({ ...c, memoryExcluded: true });
    store.finishJob(old.id, old.body);
    assert.equal(store.queueStatus().replication.pending, 1);

    const latest = store.jobs('replicate')[0];

    assert.equal(JSON.parse(latest.body).data.memoryExcluded, true);
    store.finishJob(latest.id, latest.body);
    assert.equal(store.queueStatus().replication.pending, 0);
    store.db.close();
});
