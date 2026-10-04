import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalStore } from '../src/core/local-store.js';
import type { StateChange } from '../src/core/state-record.js';

class ControlledStore extends LocalStore {
    release!: () => void;
    rejectCommit = false;
    private gate = new Promise<void>((resolve) => {
        this.release = resolve;
    });

    protected override async commit(changes: StateChange[]) {
        await this.gate;

        if (this.rejectCommit) {
            throw new Error('Database rejected the transaction.');
        }

        await super.commit(changes);
    }

    disconnect() {
        this.available = false;
    }
}

test('unconfirmed writes stay out of the shared read snapshot', async () => {
    const store = new ControlledStore();
    let staged!: () => void;
    const prepared = new Promise<void>((resolve) => {
        staged = resolve;
    });
    let completed = false;
    const pending = store
        .transaction(async () => {
            await store.put('test', 'one', { value: 1 });
            await store.put('test', 'two', { value: 2 });
            assert.equal(store.list('test').length, 2);
            staged();
        })
        .then(() => {
            completed = true;
        });

    await prepared;
    assert.deepEqual(store.list('test'), []);
    assert.equal(completed, false);
    store.release();
    await pending;
    assert.equal(store.list('test').length, 2);
    assert.equal(completed, true);
    store.close();
});

test('rejected commits expose neither optimistic state nor partial outbox work', async () => {
    const store = new ControlledStore();

    store.rejectCommit = true;
    store.release();
    await assert.rejects(
        () =>
            store.transaction(async () => {
                await store.put('approval', 'decision', { status: 'approved' });
                await store.enqueue('message', { text: 'Approved' }, 'reply');
            }),
        /Database rejected/,
    );
    assert.equal(store.get('approval', 'decision'), undefined);
    assert.equal(store.queueStatus().messages.pending, 0);
    store.close();
});

test('disconnection retains the last snapshot but blocks state changes', async () => {
    const store = new ControlledStore();

    store.release();
    await store.put('test', 'one', { saved: true });
    store.disconnect();
    assert.deepEqual(store.get('test', 'one'), { saved: true });
    assert.throws(() => store.assertAvailable(), /reconnecting/);
    await assert.rejects(
        () => store.put('test', 'two', { saved: false }),
        /reconnecting/,
    );
    assert.equal(store.get('test', 'two'), undefined);
    store.close();
});

test('a stale call update preserves a concurrent stop and rejects conflicting edits', async () => {
    const store = new LocalStore();
    const initial = await store.saveCase({
        id: 'concurrent',
        owner: 'test',
        spaceId: 'web:test',
        title: 'Call',
        status: 'in_call',
        goal: 'Ask a question',
        business: '',
        phone: '',
        customerName: '',
        context: '',
        authorization: 'Ask only',
        createdAt: 1,
        updatedAt: 1,
    });

    await store.saveCase({ ...initial, stopRequestedAt: 100 });
    await store.saveCase({ ...initial, conversationId: 'conversation' });
    assert.equal(store.case(initial.id)?.stopRequestedAt, 100);
    assert.equal(store.case(initial.id)?.conversationId, 'conversation');

    const before = store.case(initial.id)!;

    await store.saveCase({ ...before, status: 'cancelled' });
    await assert.rejects(
        () => store.saveCase({ ...before, status: 'resolved' }),
        /case changed/,
    );
    assert.equal(store.case(initial.id)?.status, 'cancelled');
    store.close();
});
