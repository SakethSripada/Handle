import { z } from 'zod';
import type { Case, Approval } from './model.js';
import type { Conversation } from '../providers/elevenlabs.js';

export const verdictSchema = z.object({
    resolved: z.boolean(),
    summary: z.string().trim().min(1).max(2000),
    confirmation: z.string().max(2000),
    reason: z.string().max(1000),
});

const normalize = (text: string) =>
    text.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();

export async function verifyOutcome(
    verify: (prompt: string) => Promise<string>,
    c: Case,
    transcript: NonNullable<Conversation['transcript']>,
    approvals: Approval[],
) {
    const answer = await verify(
        JSON.stringify({
            goal: c.goal,
            authority: c.authorization,
            proposedOutcome: c.proposedOutcome,
            decisions: approvals.map((a) => ({
                question: a.question,
                status: a.status,
            })),
            transcript: transcript
                .filter((t) => t.message)
                .map((t) => ({
                    speaker: t.role === 'user' ? 'business' : 'assistant',
                    text: t.message,
                })),
        }),
    );
    const verdict = verdictSchema.parse(
        JSON.parse(
            answer.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, ''),
        ),
    );
    const quote = normalize(verdict.confirmation);
    const grounded =
        quote.length > 0 &&
        transcript.some(
            (t) =>
                t.role === 'user' &&
                t.message &&
                (quote.length < 12
                    ? normalize(t.message) === quote
                    : normalize(t.message).includes(quote)),
        );

    if (verdict.resolved && !grounded) {
        return {
            ...verdict,
            resolved: false,
            reason: 'The proposed completion quote was not found in the business transcript.',
        };
    }

    return verdict;
}
