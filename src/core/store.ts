import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { Case, CaseEvent, Approval } from './model.js';
import {
    recordKey,
    type StateChange,
    type StateRecord,
} from './state-record.js';

const snapshot = Symbol('recordSnapshot');

function decode<T>(data: string, kind: string): T {
    const value = JSON.parse(data);

    if (kind === 'case' && value && typeof value === 'object') {
        value[snapshot] = data;
    }

    return value as T;
}

interface Transaction {
    changes: Map<string, StateChange>;
}

interface Job {
    id: string;
    kind: string;
    body: string;
    attempts: number;
    nextAt: number;
    createdAt: number;
}

interface Inbox {
    id: string;
    body: string;
    done: boolean;
    createdAt: number;
}

// Reads come from a committed subscription snapshot. Writes resolve only after
// the backing database accepts the entire transaction.
export abstract class Store extends EventEmitter {
    protected records = new Map<string, StateRecord>();
    protected available = true;
    private context = new AsyncLocalStorage<Transaction>();
    private pending: Promise<unknown> = Promise.resolve();
    private changeQueued = false;

    protected abstract commit(changes: StateChange[]): Promise<void>;
    abstract close(): void | Promise<void>;

    protected changed() {
        if (this.changeQueued) {
            return;
        }

        this.changeQueued = true;
        queueMicrotask(() => {
            this.changeQueued = false;
            this.emit('change');
        });
    }

    assertAvailable() {
        if (!this.available) {
            throw new Error(
                'SpacetimeDB is reconnecting. No new action was authorized.',
            );
        }
    }

    get<T>(kind: string, id: string): T | undefined {
        const key = recordKey(kind, id);
        const row =
            this.context.getStore()?.changes.get(key) ?? this.records.get(key);

        return row && !row.deleted ? decode<T>(row.data, kind) : undefined;
    }

    list<T>(kind: string): T[] {
        const rows = new Map(this.records);

        for (const [key, row] of this.context.getStore()?.changes ?? []) {
            rows.set(key, { ...row, key, revision: row.expectedRevision + 1 });
        }

        return [...rows.values()]
            .filter((row) => row.kind === kind && !row.deleted)
            .map((row) => decode<T>(row.data, kind));
    }

    async put<T>(kind: string, id: string, body: T) {
        await this.write(kind, id, JSON.stringify(body), false);
    }

    async remove(kind: string, id: string) {
        await this.write(kind, id, '', true);
    }

    private async write(
        kind: string,
        id: string,
        data: string,
        deleted: boolean,
    ) {
        if (!this.context.getStore()) {
            await this.transaction(() => this.write(kind, id, data, deleted));

            return;
        }

        const key = recordKey(kind, id);
        const changes = this.context.getStore()!.changes;
        const expectedRevision =
            changes.get(key)?.expectedRevision ??
            this.records.get(key)?.revision ??
            0;

        changes.set(key, { kind, id, data, deleted, expectedRevision });
    }

    async transaction<T>(fn: () => T | Promise<T>): Promise<T> {
        if (this.context.getStore()) {
            return fn();
        }

        const run = this.pending
            .catch(() => {})
            .then(async () => {
                this.assertAvailable();

                const transaction = { changes: new Map<string, StateChange>() };

                return this.context.run(transaction, async () => {
                    const result = await fn();

                    if (transaction.changes.size) {
                        await this.commit([...transaction.changes.values()]);
                    }

                    return result;
                });
            });

        this.pending = run;

        return run;
    }

    cases() {
        return this.list<Case>('case').sort(
            (a, b) => b.updatedAt - a.updatedAt,
        );
    }

    case(id: string) {
        return this.get<Case>('case', id);
    }

    async saveCase(c: Case) {
        return this.transaction(async () => {
            const current = this.case(c.id);
            const original = (c as Case & { [snapshot]?: string })[snapshot];
            const base = original ? (JSON.parse(original) as Case) : undefined;
            let saved = { ...c };

            if (current && base?.id === c.id) {
                // Preserve independently updated fields (for example a stop
                // request arriving while a transcript is being fetched).
                saved = { ...current };

                for (const key of Object.keys({
                    ...base,
                    ...c,
                }) as (keyof Case)[]) {
                    if (
                        key === 'updatedAt' ||
                        JSON.stringify(c[key]) === JSON.stringify(base[key])
                    ) {
                        continue;
                    }

                    if (
                        JSON.stringify(current[key]) !==
                            JSON.stringify(base[key]) &&
                        JSON.stringify(current[key]) !== JSON.stringify(c[key])
                    ) {
                        throw new Error(
                            'The case changed while this action was being prepared. Please retry.',
                        );
                    }

                    Object.assign(saved, { [key]: c[key] });
                }
            }

            saved.updatedAt = Math.max(
                Date.now(),
                (current?.updatedAt ?? 0) + 1,
            );
            await this.put('case', c.id, saved);

            return this.case(c.id)!;
        });
    }

    async event(
        caseId: string,
        kind: CaseEvent['kind'],
        actor: CaseEvent['actor'],
        text: string,
        id: string = randomUUID(),
    ) {
        return this.transaction(async () => {
            const existing = this.get<CaseEvent>('event', id);

            if (existing) {
                return existing;
            }

            const event: CaseEvent = {
                id,
                caseId,
                kind,
                actor,
                text,
                at: Date.now(),
            };

            await this.put('event', id, event);

            return event;
        });
    }

    events(caseId: string) {
        return this.list<CaseEvent>('event')
            .filter((e) => e.caseId === caseId)
            .sort((a, b) => a.at - b.at);
    }

    approvals(caseId: string) {
        return this.list<Approval>('approval').filter(
            (a) => a.caseId === caseId,
        );
    }

    async enqueue(kind: string, body: unknown, id: string = randomUUID()) {
        await this.transaction(async () => {
            const existing = this.get<Job>('outbox', id);

            await this.put('outbox', id, {
                id,
                kind,
                body: JSON.stringify(body),
                attempts: existing?.attempts ?? 0,
                nextAt: existing?.nextAt ?? 0,
                createdAt: existing?.createdAt ?? Date.now(),
            });
        });
    }

    queueStatus() {
        const jobs = this.list<Job>('outbox');
        const counts = (kind: string) => ({
            pending: jobs.filter((j) => j.kind === kind).length,
            retrying: jobs.filter((j) => j.kind === kind && j.attempts > 0)
                .length,
        });

        return {
            messages: counts('message'),
            replication: counts('replicate'),
            incoming: this.pendingInbox().length,
        };
    }

    jobs(kind: string) {
        return this.list<Job>('outbox')
            .filter((j) => j.kind === kind && j.nextAt <= Date.now())
            .sort((a, b) => a.createdAt - b.createdAt)
            .slice(0, 20);
    }

    async finishJob(id: string, body?: string) {
        await this.transaction(async () => {
            const job = this.get<Job>('outbox', id);

            if (job && (!body || job.body === body)) {
                await this.remove('outbox', id);
            }
        });
    }

    async retryJob(id: string, attempts: number) {
        await this.transaction(async () => {
            const job = this.get<Job>('outbox', id);

            if (job) {
                await this.put('outbox', id, {
                    ...job,
                    attempts: job.attempts + 1,
                    nextAt: Date.now() + Math.min(60000, 1000 * 2 ** attempts),
                });
            }
        });
    }

    async receive(id: string, body: unknown) {
        return this.transaction(async () => {
            if (this.get('inbox', id)) {
                return false;
            }

            await this.put('inbox', id, {
                id,
                body: JSON.stringify(body),
                done: false,
                createdAt: Date.now(),
            });

            return true;
        });
    }

    pendingInbox() {
        return this.list<Inbox>('inbox')
            .filter((r) => !r.done)
            .sort((a, b) => a.createdAt - b.createdAt);
    }

    async completeInbox(id: string) {
        await this.transaction(async () => {
            const row = this.get<Inbox>('inbox', id);

            if (row) {
                await this.put('inbox', id, { ...row, done: true });
            }
        });
    }
}
