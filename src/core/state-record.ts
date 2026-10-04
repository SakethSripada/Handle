export interface StateRecord {
    key: string;
    kind: string;
    id: string;
    data: string;
    revision: number;
    deleted: boolean;
}

export interface StateChange {
    kind: string;
    id: string;
    data: string;
    expectedRevision: number;
    deleted: boolean;
}

export const recordKey = (kind: string, id: string) =>
    JSON.stringify([kind, id]);
