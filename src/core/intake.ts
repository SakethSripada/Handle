import { z } from 'zod';
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

export async function planIntake(
    textAgent: (prompt: string) => Promise<string>,
    c: Case,
    events: CaseEvent[],
    evidence: unknown[] = [],
): Promise<IntakePlan> {
    const answer = await textAgent(
        JSON.stringify({
            emailEvidence: evidence,
            existingCase: {
                goal: c.goal,
                business: c.business,
                phone: c.phone,
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

    parsed.phone = normalizePhone(parsed.phone);
    parsed.ready =
        parsed.ready &&
        Boolean(
            parsed.goal &&
            parsed.phone &&
            parsed.customerName &&
            parsed.context &&
            parsed.authorization,
        );

    return parsed;
}
