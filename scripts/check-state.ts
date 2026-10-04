import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { loadConfig } from '../src/config.js';
import { Spacetime } from '../src/providers/spacetime.js';
import { DbConnection } from '../src/generated/index.js';
import type { Case, Approval } from '../src/core/model.js';

// Requires the live backend to be stopped: this check owns the writer lease.
// Uses fictional rows, never an LLM, message delivery, or a telephone provider.
const config = loadConfig();
let store = await Spacetime.open(config);
const id = `storage-check-${randomUUID()}`;
let observer: DbConnection | undefined;
const c: Case = {
    id,
    owner: '+12025550142',
    spaceId: 'web:storage-test',
    mode: 'rehearsal',
    title: 'Storage verification',
    status: 'in_call',
    goal: 'Verify storage',
    business: 'Fictional test',
    phone: '+12025550110',
    customerName: '',
    context: '',
    authorization: 'No actions',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    memoryExcluded: true,
};

try {
    let received!: () => void;
    const update = new Promise<void>((resolve) => {
        received = resolve;
    });

    await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
            () => reject(new Error('Observer subscription timed out.')),
            10000,
        );

        observer = DbConnection.builder()
            .withUri(config.SPACETIMEDB_URL)
            .withDatabaseName(config.SPACETIMEDB_DATABASE)
            .withToken(config.SPACETIMEDB_TOKEN)
            .onConnect((conn) => {
                conn.db.callCase.onInsert((_ctx, row) => {
                    if (row.id === id) {
                        received();
                    }
                });
                conn.subscriptionBuilder()
                    .onApplied(() => {
                        clearTimeout(timeout);
                        resolve();
                    })
                    .onError(() =>
                        reject(new Error('Observer could not subscribe.')),
                    )
                    .subscribe('SELECT * FROM call_case');
            })
            .onConnectError(() =>
                reject(new Error('Observer could not connect.')),
            )
            .build();
    });
    await store.saveCase(c);
    await Promise.race([
        update,
        delay(5000).then(() => {
            throw new Error('Independent observer missed the update.');
        }),
    ]);
    console.log(
        'PASS independent live subscription receives committed case state',
    );
    await store.receive(id, { text: 'fictional input' });
    assert.equal(await store.receive(id, { text: 'duplicate' }), false);
    console.log('PASS incoming delivery deduplication');

    const approval: Approval = {
        id,
        caseId: id,
        question: 'Allow a fictional fee?',
        status: 'pending',
        createdAt: Date.now() - 10000,
        expiresAt: Date.now() - 1000,
    };

    await store.put('approval', id, approval);
    await assert.rejects(() =>
        store.transaction(async () => {
            await store.put('storage-test', id, { shouldRollback: true });
            await store.put('approval', id, {
                ...approval,
                status: 'approved',
                answeredBy: c.owner,
            });
        }),
    );
    assert.equal(store.get('storage-test', id), undefined);
    assert.equal(store.get<Approval>('approval', id)?.status, 'pending');
    console.log(
        'PASS expired decision rejected and entire transaction rolled back',
    );

    await store.remove('approval', id);
    await store.saveCase({ ...store.case(id)!, stopRequestedAt: Date.now() });
    await assert.rejects(() =>
        store.saveCase({
            ...store.case(id)!,
            status: 'resolved',
            confirmation: 'Fictional reference',
            confirmedAt: Date.now(),
        }),
    );
    assert.equal(store.case(id)?.status, 'in_call');
    console.log(
        'PASS a stopped call cannot be marked resolved by the database',
    );

    const lease = await fetch(
        `${config.SPACETIMEDB_URL}/v1/database/${config.SPACETIMEDB_DATABASE}/call/acquire_writer`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${config.SPACETIMEDB_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify([randomUUID()]),
        },
    );

    assert.equal(lease.ok, false);
    console.log('PASS second active writer denied');

    const unauthorized = await fetch(
        `${config.SPACETIMEDB_URL}/v1/database/${config.SPACETIMEDB_DATABASE}/sql`,
        { method: 'POST', body: 'SELECT * FROM call_case' },
    );

    assert.equal(unauthorized.ok, false);
    console.log('PASS anonymous reads of private cases denied');
    await store.close();
    store = await Spacetime.open(config);
    assert.equal(store.case(id)?.title, c.title);
    assert.ok(store.pendingInbox().some((row) => row.id === id));
    console.log(
        'PASS fresh connection restores case and pending inbox without SQLite',
    );
    await delay(11000);
    await store.put('storage-test', id, { heartbeat: true });
    console.log('PASS writer lease renewal retains write access');
} finally {
    for (const kind of ['case', 'approval', 'inbox', 'storage-test']) {
        if (store.get(kind, id)) {
            await store.remove(kind, id);
        }
    }

    observer?.disconnect();
    await store.close();
}
