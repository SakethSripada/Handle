import type { Case, CaseEvent, Approval } from '../src/core/model.js';

export type { Case, CaseEvent, Approval };

export interface State {
    cases: Case[];
    events: CaseEvent[];
    approvals: Approval[];
    owner: string;
    queues?: {
        messages: { pending: number; retrying: number };
        replication: { pending: number; retrying: number };
        incoming: number;
    };
    services: {
        photon: string;
        voice: string;
        intake: string;
        calling: boolean;
        spacetime: string;
        lastSyncedAt?: number;
        gmail: string;
    };
}

export const statusLabels: Record<string, string> = {
    gathering: 'Getting the details',
    ready: 'Ready to call',
    dialing: 'Dialing',
    in_call: 'On the line',
    waiting_approval: 'Your decision',
    resolved: 'Handled',
    follow_up: 'Follow-up needed',
    failed: 'Needs attention',
    cancelled: 'Stopped',
};

export async function request<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`/api${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const value = await response.json();

    if (!response.ok) {
        throw new Error(value.error ?? 'Something went wrong.');
    }

    return value;
}
