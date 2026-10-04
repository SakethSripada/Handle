import type { Store } from './store.js';
import type { Gmail, MailEvidence } from '../providers/gmail.js';
import type { Case } from './model.js';
import { planIntake } from './intake.js';
import { recallCalls } from './memory.js';

export async function planRequest(
    store: Store,
    gmail: Gmail,
    text: (prompt: string) => Promise<string>,
    c: Case,
) {
    const plan = await planIntake(
        text,
        c,
        store.events(c.id),
        [],
        recallCalls(store, c),
    );

    if (!plan.needsEmail) {
        return plan;
    }

    // Older text-agent configurations may return a business without emailQuery.
    const query =
        plan.emailQuery ||
        (plan.business ? `"${plan.business.replace(/["\\]/g, '')}"` : '');

    if (!query) {
        return {
            ...plan,
            ready: false,
            reply: 'What email should I look for? A sender, subject, business, or reference will help.',
        };
    }

    if (!gmail.connected(c.owner)) {
        return {
            ...plan,
            ready: false,
            reply: 'Gmail isn’t connected yet. Text connect gmail, finish Google’s consent, then send your request again. You can also paste the relevant details here.',
        };
    }

    let emails: MailEvidence[];

    try {
        emails = await gmail.search(c.owner, query);
    } catch {
        await store.event(
            c.id,
            'status',
            'system',
            'Gmail lookup was unavailable; no email result was assumed.',
        );

        return {
            ...plan,
            ready: false,
            reply: 'I couldn’t access Gmail for that search, so I haven’t started a call. Try again, or text connect gmail to reconnect.',
        };
    }

    for (const email of emails) {
        await store.event(
            c.id,
            'email',
            'system',
            `${email.subject}\nFrom: ${email.from}\n${email.date}`,
            `email:${c.id}:${email.id}`,
        );
    }

    const result = await planIntake(
        text,
        { ...c, ...plan },
        store.events(c.id),
        emails,
        recallCalls(store, { ...c, ...plan }),
        { status: emails.length ? 'found' : 'empty', query },
    );

    // Email contents can supply facts, never expand the user's original authority.
    result.authorization = plan.authorization;
    result.emailOnly = plan.emailOnly || result.emailOnly;
    result.ready = result.ready && !result.emailOnly && emails.length > 0;

    return result;
}
