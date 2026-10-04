import { DatabaseSync } from 'node:sqlite';
import { Store } from './store.js';
import {
    recordKey,
    type StateChange,
    type StateRecord,
} from './state-record.js';

// Used by isolated tests and the one-time migration, never by the live server.
export class LocalStore extends Store {
    readonly db: DatabaseSync;

    constructor(path = ':memory:') {
        super();
        this.db = new DatabaseSync(path);
        this.db.exec(
            'CREATE TABLE IF NOT EXISTS state_records (key TEXT PRIMARY KEY, row TEXT NOT NULL)',
        );

        for (const row of this.db
            .prepare('SELECT row FROM state_records')
            .all() as { row: string }[]) {
            const value = JSON.parse(row.row) as StateRecord;

            this.records.set(value.key, value);
        }
    }

    protected async commit(changes: StateChange[]) {
        const rows = changes.map((change) => ({
            ...change,
            key: recordKey(change.kind, change.id),
            revision: change.expectedRevision + 1,
        }));

        this.db.exec('BEGIN IMMEDIATE');

        try {
            for (const row of rows) {
                if (
                    (this.records.get(row.key)?.revision ?? 0) !==
                    row.expectedRevision
                ) {
                    throw new Error('State changed. Retry the operation.');
                }

                this.db
                    .prepare(
                        'INSERT INTO state_records VALUES (?,?) ON CONFLICT(key) DO UPDATE SET row=excluded.row',
                    )
                    .run(row.key, JSON.stringify(row));
            }

            this.db.exec('COMMIT');
        } catch (error) {
            this.db.exec('ROLLBACK');
            throw error;
        }

        for (const row of rows) {
            this.records.set(row.key, row);
        }

        this.changed();
    }

    close() {
        this.db.close();
    }
}
