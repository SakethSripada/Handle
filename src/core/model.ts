export const activeStatuses = [
    'gathering',
    'ready',
    'dialing',
    'in_call',
    'waiting_approval',
] as const;

export type CaseStatus =
    | (typeof activeStatuses)[number]
    | 'resolved'
    | 'follow_up'
    | 'failed'
    | 'cancelled';

export interface Case {
    mode?: 'rehearsal';
    id: string;
    owner: string;
    spaceId: string;
    line?: string;
    title: string;
    status: CaseStatus;
    goal: string;
    business: string;
    phone: string;
    customerName: string;
    context: string;
    authorization: string;
    createdAt: number;
    updatedAt: number;
    conversationId?: string;
    voiceProvider?: 'twilio' | 'photon';
    callSid?: string;
    sipCallId?: string;
    stopRequestedAt?: number;
    callToken?: string;
    outcome?: string;
}

export interface CaseEvent {
    id: string;
    caseId: string;
    kind: 'message' | 'status' | 'transcript' | 'approval' | 'email' | 'error';
    actor: 'user' | 'handle' | 'business' | 'system';
    text: string;
    at: number;
}

export interface Approval {
    id: string;
    caseId: string;
    question: string;
    status: 'pending' | 'approved' | 'declined' | 'expired';
    answer?: string;
    createdAt: number;
    expiresAt: number;
}

export interface Incoming {
    caseId?: string;
    mode?: 'rehearsal';
    id: string;
    owner: string;
    spaceId: string;
    line?: string;
    text: string;
}

export interface Messenger {
    send(spaceId: string, text: string, line?: string): Promise<void>;
}

export interface IntakePlan {
    title: string;
    goal: string;
    business: string;
    phone: string;
    customerName: string;
    context: string;
    authorization: string;
    ready: boolean;
    reply: string;
}
