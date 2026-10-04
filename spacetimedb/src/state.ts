import { table, t, SenderError } from 'spacetimedb/server';

const record = {
    key: t.string().primaryKey(),
    kind: t.string(),
    id: t.string(),
    data: t.string(),
    revision: t.u32(),
    deleted: t.bool(),
};

export const callCase = table(
    { name: 'call_case' },
    { ...record, owner: t.string(), status: t.string() },
);

export const callEvent = table(
    { name: 'call_event' },
    {
        ...record,
        caseId: t.string(),
        actor: t.string(),
        eventKind: t.string(),
        at: t.f64(),
    },
);

export const callApproval = table(
    { name: 'call_approval' },
    { ...record, caseId: t.string(), status: t.string(), expiresAt: t.f64() },
);

export const appRecord = table({ name: 'app_record' }, record);

export const writerLease = table(
    { name: 'writer_lease' },
    { id: t.string().primaryKey(), holder: t.string(), expiresAt: t.f64() },
);

export const changeType = t.object('StateChange', {
    kind: t.string(),
    id: t.string(),
    data: t.string(),
    expectedRevision: t.u32(),
    deleted: t.bool(),
});

export interface Change {
    kind: string;
    id: string;
    data: string;
    expectedRevision: number;
    deleted: boolean;
}

export function parseChange(change: Change) {
    if (
        !change.kind ||
        change.kind.length > 80 ||
        !change.id ||
        change.id.length > 1000 ||
        change.data.length > 150000
    ) {
        throw new SenderError('Invalid state record.');
    }

    const body = change.deleted ? {} : JSON.parse(change.data);

    if (
        ['case', 'event', 'approval'].includes(change.kind) &&
        !change.deleted &&
        body.id !== change.id
    ) {
        throw new SenderError('Record identity does not match.');
    }

    if (
        change.kind === 'case' &&
        !change.deleted &&
        (!body.owner ||
            ![
                'gathering',
                'ready',
                'dialing',
                'in_call',
                'waiting_approval',
                'verifying',
                'resolved',
                'completed',
                'follow_up',
                'failed',
                'cancelled',
            ].includes(body.status))
    ) {
        throw new SenderError('Invalid case state.');
    }

    if (
        change.kind === 'event' &&
        !change.deleted &&
        (!body.caseId ||
            !['user', 'handle', 'business', 'system'].includes(body.actor) ||
            typeof body.text !== 'string')
    ) {
        throw new SenderError('Invalid case event.');
    }

    if (
        change.kind === 'approval' &&
        !change.deleted &&
        (!body.caseId ||
            !['pending', 'approved', 'declined', 'expired'].includes(
                body.status,
            ) ||
            !Number.isFinite(body.expiresAt))
    ) {
        throw new SenderError('Invalid approval state.');
    }

    return body;
}
