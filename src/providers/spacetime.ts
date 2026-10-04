import { Store } from '../core/store.js';
import type { Config } from '../config.js';
import { jsonRequest } from './http.js';

export class Spacetime {
    status = 'not_configured';
    lastSyncedAt?: number;
    lastError?: string;

    constructor(
        private config: Config,
        private store: Store,
    ) {
        this.lastSyncedAt = store.get<number>('service', 'cloud-last-synced');

        if (config.SPACETIMEDB_TOKEN && config.SPACETIMEDB_DATABASE) {
            this.status = 'configured';
        }
    }

    async flush() {
        if (
            !this.config.SPACETIMEDB_TOKEN ||
            !this.config.SPACETIMEDB_DATABASE
        ) {
            return;
        }

        for (const job of this.store.jobs('replicate')) {
            try {
                const data = JSON.parse(job.body);

                await jsonRequest(
                    'SpacetimeDB',
                    `${this.config.SPACETIMEDB_URL}/v1/database/${this.config.SPACETIMEDB_DATABASE}/call/sync_record`,
                    {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${this.config.SPACETIMEDB_TOKEN}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify([
                            data.table,
                            data.id,
                            JSON.stringify(data.data),
                        ]),
                    },
                );
                this.store.finishJob(job.id, job.body);
                this.lastSyncedAt = Date.now();
                this.store.put(
                    'service',
                    'cloud-last-synced',
                    this.lastSyncedAt,
                );
                this.status = 'connected';
                this.lastError = undefined;
            } catch (error) {
                this.status = 'retrying';
                this.lastError = (error as Error).message;
                this.store.retryJob(job.id, job.attempts);
                break;
            }
        }
    }
}
