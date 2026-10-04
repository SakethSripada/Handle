import { z } from 'zod';
import type { CallMemory } from './memory.js';
import type { Case, CaseEvent, IntakePlan } from './model.js';

export const planSchema = z.object({
    title: z.string().max(120),
    goal: z.string().max(3000),
    business: z.string().max(200),
    phone: z.string().max(30),
    customerName: z.string().max(200),
    context: z.string().max(10000),
    authorization: z.string().max(3000),
    ready: z.boolean(),
    needsEmail: z.boolean().default(false),
    reply: z.string().min(1).max(1500),
});

export function normalizePhone(value: string): string {
    const digits = value.replace(/\D/g, '');

    if (digits.length === 10) {
        return `+1${digits}`;
    }

    if (digits.length >= 11 && digits.length <= 15) {
        return `+${digits}`;
    }

    return '';
}

export function explicitDialNumber(events: CaseEvent[]) {
    const event = [...events]
        .reverse()
        .find((e) => e.actor === 'user' && e.kind === 'message');

    if (!event) {
        return '';
    }

    const candidates = event.text.match(/\+?\d[\d ().-]{7,28}\d/g) ?? [];

    if (candidates.filter((value) => normalizePhone(value)).length !== 1) {
        return '';
    }

    const match = event.text.match(
        /(?:^|[.!?\n]\s*)(?:please\s+)?(?:call|(?:the\s+)?phone(?: number)?(?: is)?)\s*[:=]?\s*(\+?\d[\d ().-]{7,28}\d)/i,
    );

    return match ? normalizePhone(match[1]) : '';
}

export async function planIntake(
    textAgent: (prompt: string) => Promise<string>,
    c: Case,
    events: CaseEvent[],
    evidence: unknown[] = [],
    pastCalls: CallMemory[] = [],
): Promise<IntakePlan> {
    const explicitPhone = explicitDialNumber(events);
    const suppliedPhone = explicitPhone || c.phone;
    const answer = await textAgent(
        JSON.stringify({
            emailEvidence: evidence,
            pastCalls,
            existingCase: {
                goal: c.goal,
                business: c.business,
                phone: suppliedPhone,
                customerName: c.customerName,
                context: c.context,
                authorization: c.authorization,
            },
            conversation: events
                .filter((e) => e.kind === 'message')
                .slice(-30)
                .map((e) => ({ role: e.actor, text: e.text })),
        }),
    );
    const parsed = planSchema.parse(
        JSON.parse(
            answer.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, ''),
        ),
    );

    parsed.phone = explicitPhone || normalizePhone(parsed.phone);
    parsed.ready =
        parsed.ready &&
        Boolean(
            parsed.goal.trim() && parsed.phone && parsed.authorization.trim(),
        );

    return parsed;
}
