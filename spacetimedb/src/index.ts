import { schema, table, t, SenderError } from 'spacetimedb/server';

const owner = table({ name: 'owner' }, { identity: t.identity().primaryKey() });

const caseState = table(
    { name: 'case_state' },
    { id: t.string().primaryKey(), data: t.string(), updatedAt: t.timestamp() },
);

const caseEvent = table(
    { name: 'case_event' },
    { id: t.string().primaryKey(), data: t.string(), updatedAt: t.timestamp() },
);

const db = schema({ owner, caseState, caseEvent });

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
