import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { loadConfig } from '../src/config.js';
import { Spacetime } from '../src/providers/spacetime.js';
import type { StateChange } from '../src/core/state-record.js';

// Stop the old SQLite-backed service before running this once. Existing cloud
// rows are compared, never overwritten, so an interrupted import can resume.
const config = loadConfig();
const local = new DatabaseSync('.data/handle.sqlite', { readOnly: true });
const store = await Spacetime.open(config);

try {
    if (store.get('migration', 'sqlite-v1')) {
        throw new Error('Migration already completed.');
    }

    mkdirSync('.data/backups', { recursive: true, mode: 0o700 });

    const backupPath = `.data/backups/before-spacetime-${Date.now()}.sqlite`;

    await backup(local, backupPath);
    chmodSync(backupPath, 0o600);

    const records = local
        .prepare(
            "SELECT kind,id,body FROM records ORDER BY CASE kind WHEN 'case' THEN 0 WHEN 'approval' THEN 1 ELSE 2 END",
        )
        .all() as { kind: string; id: string; body: string }[];
    const incoming = local
        .prepare('SELECT id,body,done,rowid FROM inbox ORDER BY rowid')
        .all() as { id: string; body: string; done: number; rowid: number }[];
    const outgoing = local
        .prepare(
            "SELECT id,kind,body,attempts,next_at,rowid FROM outbox WHERE kind != 'replicate' ORDER BY rowid",
        )
        .all() as {
        id: string;
        kind: string;
        body: string;
        attempts: number;
        next_at: number;
        rowid: number;
    }[];

    for (const row of incoming) {
        records.push({
            kind: 'inbox',
            id: row.id,
            body: JSON.stringify({
                id: row.id,
                body: row.body,
                done: Boolean(row.done),
                createdAt: row.rowid,
            }),
        });
    }

    for (const row of outgoing) {
        records.push({
            kind: 'outbox',
            id: row.id,
            body: JSON.stringify({
                id: row.id,
                kind: row.kind,
                body: row.body,
                attempts: row.attempts,
                nextAt: row.next_at,
                createdAt: row.rowid,
            }),
        });
    }

    let imported = 0;

    for (let offset = 0; offset < records.length; offset += 100) {
        const changes: StateChange[] = [];

        for (const row of records.slice(offset, offset + 100)) {
            const existing = store.get(row.kind, row.id);

            if (existing !== undefined) {
                if (JSON.stringify(existing) !== row.body) {
                    throw new Error(
                        'Existing cloud state differs; migration stopped without overwriting it.',
                    );
                }

                continue;
            }

            changes.push({
                kind: row.kind,
                id: row.id,
                data: row.body,
                expectedRevision: 0,
                deleted: false,
            });
        }

        if (changes.length) {
            await store.importRecords(changes);
        }

        imported += changes.length;
    }

    for (const row of records) {
        if (JSON.stringify(store.get(row.kind, row.id)) !== row.body) {
            throw new Error('Subscription verification failed after import.');
        }
    }

    await store.put('migration', 'sqlite-v1', {
        completedAt: Date.now(),
        records: records.length,
    });
    console.log(
        `Verified ${records.length} records in SpacetimeDB (${imported} imported). SQLite backup retained locally.`,
    );
} finally {
    local.close();
    await store.close();
}
