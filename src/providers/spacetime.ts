import { randomUUID } from 'node:crypto';
import { Store } from '../core/store.js';
import {
    recordKey,
    type StateChange,
    type StateRecord,
} from '../core/state-record.js';
import type { Config } from '../config.js';
import { DbConnection } from '../generated/index.js';

export class Spacetime extends Store {
    status = 'connecting';
    lastSyncedAt?: number;
    private connection?: DbConnection;
    private readonly holder = randomUUID();
    private heartbeat?: ReturnType<typeof setInterval>;
    private reconnect?: ReturnType<typeof setTimeout>;
    private closed = false;
    private leaseUntil = 0;

    private constructor(private config: Config) {
        super();
        this.available = false;
    }

    static async open(config: Config) {
        if (!config.SPACETIMEDB_TOKEN || !config.SPACETIMEDB_DATABASE) {
            throw new Error(
                'Configure SpacetimeDB before starting Handle. Local storage is not a fallback.',
            );
        }

        const store = new Spacetime(config);

        try {
            await store.connect();
        } catch (error) {
            await store.close();
            throw error;
        }

        return store;
    }

    private async connect() {
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(
                () =>
                    reject(
                        new Error(
                            'SpacetimeDB subscription did not become ready.',
                        ),
                    ),
                20000,
            );
            const fail = () => {
                clearTimeout(timeout);
                reject(
                    new Error(
                        'SpacetimeDB connection failed. Check the service credentials.',
                    ),
                );
            };

            const connection = DbConnection.builder()
                .withUri(this.config.SPACETIMEDB_URL)
                .withDatabaseName(this.config.SPACETIMEDB_DATABASE)
                .withToken(this.config.SPACETIMEDB_TOKEN)
                .onConnect((conn) => {
                    const snapshot = new Map<string, StateRecord>();
                    const apply = (row: StateRecord) => {
                        snapshot.set(row.key, row);

                        if (this.available) {
                            this.records.set(row.key, row);
                            this.lastSyncedAt = Date.now();
                            this.changed();
                        }
                    };

                    for (const table of [
                        conn.db.callCase,
                        conn.db.callEvent,
                        conn.db.callApproval,
                        conn.db.appRecord,
                    ]) {
                        table.onInsert((_ctx, row) => apply(row));
                        table.onUpdate((_ctx, _old, row) => apply(row));
                    }

                    conn.subscriptionBuilder()
                        .onError(() => {
                            fail();
                            this.disconnected();
                        })
                        .onApplied(() => {
                            void (async () => {
                                await conn.reducers.acquireWriter({
                                    holder: this.holder,
                                });
                                this.leaseUntil = Date.now() + 20000;
                                this.records = snapshot;
                                this.available = true;
                                this.status = 'connected';
                                this.lastSyncedAt = Date.now();
                                this.changed();
                                this.emit('online');
                                clearTimeout(timeout);
                                this.heartbeat = setInterval(() => {
                                    void conn.reducers
                                        .acquireWriter({ holder: this.holder })
                                        .then(() => {
                                            this.leaseUntil =
                                                Date.now() + 20000;
                                        })
                                        .catch(() => this.disconnected());
                                }, 10000);
                                resolve();
                            })().catch(fail);
                        })
                        .subscribe([
                            'SELECT * FROM call_case',
                            'SELECT * FROM call_event',
                            'SELECT * FROM call_approval',
                            'SELECT * FROM app_record',
                        ]);
                })
                .onConnectError(fail)
                .onDisconnect(() => {
                    fail();

                    if (this.connection === connection) {
                        this.disconnected();
                    }
                })
                .build();

            this.connection = connection;
        });
    }

    private disconnected() {
        this.available = false;
        this.status = this.closed ? 'stopped' : 'reconnecting';
        clearInterval(this.heartbeat);
        this.changed();

        if (!this.closed && !this.reconnect) {
            this.reconnect = setTimeout(() => {
                this.reconnect = undefined;

                const previous = this.connection;

                this.connection = undefined;
                previous?.disconnect();
                void this.connect().catch(() => this.disconnected());
            }, 2000);
        }
    }

    protected async commit(changes: StateChange[]) {
        this.assertAvailable();

        let timeout: ReturnType<typeof setTimeout> | undefined;

        try {
            await Promise.race([
                this.connection!.reducers.commitState({
                    holder: this.holder,
                    changes,
                    importing: false,
                }),
                new Promise<never>((_resolve, reject) => {
                    timeout = setTimeout(
                        () =>
                            reject(
                                new Error(
                                    'SpacetimeDB did not confirm the write. No new action was authorized.',
                                ),
                            ),
                        15000,
                    );
                }),
            ]);

            // Reducer completion follows application of its subscription update.
            for (const change of changes) {
                const row = this.records.get(recordKey(change.kind, change.id));

                if (!row || row.revision < change.expectedRevision + 1) {
                    throw new Error(
                        'SpacetimeDB has not confirmed the subscription update.',
                    );
                }
            }
        } finally {
            clearTimeout(timeout);
        }
    }

    override assertAvailable() {
        super.assertAvailable();

        if (Date.now() >= this.leaseUntil) {
            throw new Error(
                'SpacetimeDB writer lease is unavailable. No new action was authorized.',
            );
        }
    }

    async importRecords(changes: StateChange[]) {
        this.assertAvailable();
        await this.connection!.reducers.commitState({
            holder: this.holder,
            changes,
            importing: true,
        });
    }

    async close() {
        this.closed = true;
        this.available = false;
        clearInterval(this.heartbeat);
        clearTimeout(this.reconnect);

        try {
            await this.connection?.reducers.releaseWriter({
                holder: this.holder,
            });
        } catch {
            /* A disconnected lease expires on the database after 30 seconds. */
        }

        this.connection?.disconnect();
    }
}
