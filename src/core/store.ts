import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { Case, CaseEvent, Approval } from './model.js';

export class Store extends EventEmitter {
    readonly db: DatabaseSync;

    constructor(path = '.data/handle.sqlite') {
        super();

        if (path !== ':memory:') {
            mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
        }

        this.db = new DatabaseSync(path);
        this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS records (kind TEXT, id TEXT, body TEXT NOT NULL, PRIMARY KEY(kind,id));
      CREATE TABLE IF NOT EXISTS inbox (id TEXT PRIMARY KEY, body TEXT NOT NULL, done INTEGER DEFAULT 0);
      CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY, kind TEXT, body TEXT, attempts INTEGER DEFAULT 0, next_at INTEGER DEFAULT 0);
    `);
    }

    get<T>(kind: string, id: string): T | undefined {
        const row = this.db
            .prepare('SELECT body FROM records WHERE kind=? AND id=?')
            .get(kind, id) as { body: string } | undefined;

        return row && (JSON.parse(row.body) as T);
    }

    list<T>(kind: string): T[] {
        return (
            this.db
                .prepare('SELECT body FROM records WHERE kind=?')
                .all(kind) as { body: string }[]
        ).map((r) => JSON.parse(r.body) as T);
    }

    put<T>(kind: string, id: string, body: T) {
        this.db
            .prepare(
                'INSERT INTO records VALUES (?,?,?) ON CONFLICT(kind,id) DO UPDATE SET body=excluded.body',
            )
            .run(kind, id, JSON.stringify(body));
        this.emit('change');
    }

    remove(kind: string, id: string) {
        this.db
            .prepare('DELETE FROM records WHERE kind=? AND id=?')
            .run(kind, id);
    }

    transaction<T>(fn: () => T): T {
        this.db.exec('BEGIN IMMEDIATE');

        try {
            const value = fn();

            this.db.exec('COMMIT');

            return value;
        } catch (error) {
            this.db.exec('ROLLBACK');
            throw error;
        }
    }

    cases() {
        return this.list<Case>('case').sort(
            (a, b) => b.updatedAt - a.updatedAt,
        );
    }

    case(id: string) {
        return this.get<Case>('case', id);
    }

    saveCase(c: Case) {
        c.updatedAt = Date.now();
        this.put('case', c.id, c);

        const { callToken: _, ...safe } = c;

        this.enqueue(
            'replicate',
            { table: 'case', id: c.id, data: safe },
            `case:${c.id}`,
        );

        return c;
    }

    event(
        caseId: string,
        kind: CaseEvent['kind'],
        actor: CaseEvent['actor'],
        text: string,
        id: string = randomUUID(),
    ) {
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

        this.put('event', id, event);
        this.enqueue(
            'replicate',
            { table: 'event', id, data: event },
            `event:${id}`,
        );

        return event;
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

    enqueue(kind: string, body: unknown, id: string = randomUUID()) {
        this.db
            .prepare(
                'INSERT INTO outbox (id,kind,body) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body',
            )
            .run(id, kind, JSON.stringify(body));
    }

    jobs(kind: string) {
        return this.db
            .prepare(
                'SELECT * FROM outbox WHERE kind=? AND next_at<=? ORDER BY rowid LIMIT 20',
            )
            .all(kind, Date.now()) as unknown as {
            id: string;
            kind: string;
            body: string;
            attempts: number;
        }[];
    }

    finishJob(id: string) {
        this.db.prepare('DELETE FROM outbox WHERE id=?').run(id);
    }

    retryJob(id: string, attempts: number) {
        this.db
            .prepare(
                'UPDATE outbox SET attempts=attempts+1,next_at=? WHERE id=?',
            )
            .run(Date.now() + Math.min(60000, 1000 * 2 ** attempts), id);
    }

    receive(id: string, body: unknown) {
        return (
            this.db
                .prepare('INSERT OR IGNORE INTO inbox (id,body) VALUES (?,?)')
                .run(id, JSON.stringify(body)).changes > 0
        );
    }

    pendingInbox() {
        return this.db
            .prepare('SELECT id,body FROM inbox WHERE done=0 ORDER BY rowid')
            .all() as {
            id: string;
            body: string;
        }[];
    }

    completeInbox(id: string) {
        this.db.prepare('UPDATE inbox SET done=1 WHERE id=?').run(id);
    }
}
