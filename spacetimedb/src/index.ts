import { schema, table, t, SenderError } from 'spacetimedb/server';
import {
    callCase,
    callEvent,
    callApproval,
    appRecord,
    writerLease,
    changeType,
    parseChange,
} from './state';

const owner = table({ name: 'owner' }, { identity: t.identity().primaryKey() });

const caseState = table(
    { name: 'case_state' },
    { id: t.string().primaryKey(), data: t.string(), updatedAt: t.timestamp() },
);

const caseEvent = table(
    { name: 'case_event' },
    { id: t.string().primaryKey(), data: t.string(), updatedAt: t.timestamp() },
);

const db = schema({
    owner,
    caseState,
    caseEvent,
    callCase,
    callEvent,
    callApproval,
    appRecord,
    writerLease,
});

export default db;

export const init = db.init((ctx) => {
    ctx.db.owner.insert({ identity: ctx.sender });
});

export const syncRecord = db.reducer(
    { kind: t.string(), id: t.string(), data: t.string() },
    (ctx, { kind, id, data }) => {
        if (!ctx.db.owner.identity.find(ctx.sender)) {
            throw new SenderError(
                'Only the Handle service can write case data.',
            );
        }

        if (data.length > 100000) {
            throw new SenderError('Record is too large.');
        }

        const value = { id, data, updatedAt: ctx.timestamp };

        if (kind === 'case') {
            if (ctx.db.caseState.id.find(id)) {
                ctx.db.caseState.id.update(value);
            } else {
                ctx.db.caseState.insert(value);
            }
        } else if (kind === 'event') {
            if (!ctx.db.caseEvent.id.find(id)) {
                ctx.db.caseEvent.insert(value);
            }
        } else {
            throw new SenderError('Unknown record type.');
        }
    },
);

export const acquireWriter = db.reducer(
    { holder: t.string() },
    (ctx, { holder }) => {
        if (!ctx.db.owner.identity.find(ctx.sender)) {
            throw new SenderError('Only Handle can acquire the writer lease.');
        }

        const now = Number(ctx.timestamp.microsSinceUnixEpoch) / 1000;
        const previous = ctx.db.writerLease.id.find('primary');

        if (
            previous &&
            previous.holder !== holder &&
            previous.expiresAt > now
        ) {
            throw new SenderError('Another Handle server is already active.');
        }

        const row = { id: 'primary', holder, expiresAt: now + 30000 };

        if (previous) {
            ctx.db.writerLease.id.update(row);
        } else {
            ctx.db.writerLease.insert(row);
        }
    },
);

export const commitState = db.reducer(
    { holder: t.string(), changes: t.array(changeType), importing: t.bool() },
    (ctx, { holder, changes, importing }) => {
        if (!ctx.db.owner.identity.find(ctx.sender)) {
            throw new SenderError('Only Handle can change application state.');
        }

        const now = Number(ctx.timestamp.microsSinceUnixEpoch) / 1000;
        const lease = ctx.db.writerLease.id.find('primary');

        if (!lease || lease.holder !== holder || lease.expiresAt <= now) {
            throw new SenderError('The Handle writer lease has expired.');
        }

        if (changes.length > 300) {
            throw new SenderError('Transaction is too large.');
        }

        const migrated = ctx.db.appRecord.key.find(
            JSON.stringify(['migration', 'sqlite-v1']),
        );

        if (importing && migrated && !migrated.deleted) {
            throw new SenderError('Legacy import is already complete.');
        }

        const seen = new Set<string>();

        for (const change of changes) {
            const key = JSON.stringify([change.kind, change.id]);

            if (seen.has(key)) {
                throw new SenderError('Duplicate record in transaction.');
            }

            seen.add(key);

            const target =
                change.kind === 'case'
                    ? ctx.db.callCase
                    : change.kind === 'event'
                      ? ctx.db.callEvent
                      : change.kind === 'approval'
                        ? ctx.db.callApproval
                        : ctx.db.appRecord;
            const previous = target.key.find(key);

            if ((previous?.revision ?? 0) !== change.expectedRevision) {
                throw new SenderError('State changed. Reload and retry.');
            }

            if (importing && previous) {
                throw new SenderError('Import cannot overwrite cloud state.');
            }

            if (change.kind === 'migration' && previous) {
                throw new SenderError('Migration markers are immutable.');
            }

            const body = parseChange(change);

            if (
                change.kind === 'event' &&
                previous &&
                !previous.deleted &&
                (change.deleted || previous.data !== change.data)
            ) {
                throw new SenderError('Call history is immutable.');
            }

            if (change.kind === 'approval' && !change.deleted && !importing) {
                const old =
                    previous && !previous.deleted
                        ? JSON.parse(previous.data)
                        : undefined;
                const parent = ctx.db.callCase.key.find(
                    JSON.stringify(['case', body.caseId]),
                );

                if (!parent || parent.deleted) {
                    throw new SenderError('Approval needs an existing case.');
                }

                const c = JSON.parse(parent.data);

                if (
                    old &&
                    old.status !== 'pending' &&
                    old.status !== body.status
                ) {
                    throw new SenderError(
                        'A decision cannot be changed after it is answered.',
                    );
                }

                if (
                    ['approved', 'declined'].includes(body.status) &&
                    old?.status !== body.status
                ) {
                    if (
                        !old ||
                        old.status !== 'pending' ||
                        old.expiresAt <= now
                    ) {
                        throw new SenderError(
                            'This decision has expired or already been answered.',
                        );
                    }

                    if (
                        body.answeredBy !== c.owner ||
                        c.stopRequestedAt ||
                        !['dialing', 'in_call', 'waiting_approval'].includes(
                            c.status,
                        )
                    ) {
                        throw new SenderError(
                            'This decision cannot authorize this call.',
                        );
                    }

                    if (
                        body.expiresAt !== old.expiresAt ||
                        body.question !== old.question ||
                        body.caseId !== old.caseId
                    ) {
                        throw new SenderError(
                            'The requested decision cannot be changed while answering.',
                        );
                    }
                }
            }

            const row = {
                key,
                kind: change.kind,
                id: change.id,
                data: change.data,
                revision: change.expectedRevision + 1,
                deleted: change.deleted,
            };

            if (change.kind === 'case') {
                const value = {
                    ...row,
                    owner: body.owner ?? '',
                    status: body.status ?? '',
                };

                if (previous) {
                    ctx.db.callCase.key.update(value);
                } else {
                    ctx.db.callCase.insert(value);
                }
            } else if (change.kind === 'event') {
                const value = {
                    ...row,
                    caseId: body.caseId ?? '',
                    actor: body.actor ?? '',
                    eventKind: body.kind ?? '',
                    at: body.at ?? 0,
                };

                if (previous) {
                    ctx.db.callEvent.key.update(value);
                } else {
                    ctx.db.callEvent.insert(value);
                }
            } else if (change.kind === 'approval') {
                const value = {
                    ...row,
                    caseId: body.caseId ?? '',
                    status: body.status ?? '',
                    expiresAt: body.expiresAt ?? 0,
                };

                if (previous) {
                    ctx.db.callApproval.key.update(value);
                } else {
                    ctx.db.callApproval.insert(value);
                }
            } else {
                if (previous) {
                    ctx.db.appRecord.key.update(row);
                } else {
                    ctx.db.appRecord.insert(row);
                }
            }
        }
    },
);

export const releaseWriter = db.reducer(
    { holder: t.string() },
    (ctx, { holder }) => {
        if (!ctx.db.owner.identity.find(ctx.sender)) {
            throw new SenderError('Only Handle can release the writer lease.');
        }

        const lease = ctx.db.writerLease.id.find('primary');

        if (lease?.holder === holder) {
            ctx.db.writerLease.id.delete('primary');
        }
    },
);
