import { randomBytes } from 'node:crypto';
import { Store } from './store.js';
import type { Approval, Case } from './model.js';

export class Decisions {
    constructor(
        private store: Store,
        private notify: (c: Case, text: string) => unknown | Promise<unknown>,
    ) {}

    async request(c: Case, question: string): Promise<Approval> {
        if (this.store.case(c.id)?.stopRequestedAt) {
            throw new Error('The customer has requested this call stop.');
        }

        const pending = this.store
            .approvals(c.id)
            .find((a) => a.status === 'pending' && a.expiresAt > Date.now());

        if (pending) {
            return pending;
        }

        const a: Approval = {
            id: randomBytes(3).toString('hex').toUpperCase(),
            caseId: c.id,
            question,
            status: 'pending',
            createdAt: Date.now(),
            expiresAt: Date.now() + 180000,
        };

        await this.store.transaction(async () => {
            await this.store.put('approval', a.id, a);
            await this.store.saveCase({ ...c, status: 'waiting_approval' });
            await this.store.event(c.id, 'approval', 'handle', question);
            await this.notify(
                c,
                `${question}\nReply YES ${a.id} or NO ${a.id}. I’ll wait up to 3 minutes; silence won’t approve anything.`,
            );
        });

        return a;
    }

    async get(c: Case, id: string) {
        const a = this.store.get<Approval>('approval', id);

        if (!a || a.caseId !== c.id) {
            throw new Error('Decision does not belong to this case.');
        }

        if (a.status === 'pending' && a.expiresAt < Date.now()) {
            a.status = 'expired';
            await this.store.put('approval', id, a);
        }

        return a;
    }

    async answer(owner: string, text: string): Promise<Approval | undefined> {
        const match = text.trim().match(/^(yes|no)\s+([a-f0-9]{6})\s*[.!]?$/i);

        if (!match) {
            return;
        }

        const a = this.store.get<Approval>('approval', match[2].toUpperCase());

        if (!a) {
            throw new Error('That decision could not be found.');
        }

        const c = this.store.case(a.caseId);

        if (!c || c.owner !== owner) {
            throw new Error('That decision does not belong to you.');
        }

        if (
            c.stopRequestedAt ||
            !['in_call', 'waiting_approval', 'dialing'].includes(c.status)
        ) {
            throw new Error(
                'This call has ended; that decision can no longer authorize an action.',
            );
        }

        const current = await this.get(c, a.id);

        if (current.status !== 'pending') {
            throw new Error(
                `That decision is ${current.status}; it cannot authorize a new action.`,
            );
        }

        a.status = match[1].toLowerCase() === 'yes' ? 'approved' : 'declined';
        a.answer = text;
        a.answeredBy = owner;
        await this.store.transaction(async () => {
            await this.store.put('approval', a.id, a);
            await this.store.saveCase({ ...c, status: 'in_call' });
            await this.store.event(
                c.id,
                'approval',
                'user',
                `${a.status}: ${a.question}`,
            );
            await this.notify(
                c,
                a.status === 'approved'
                    ? 'Approved. I’ll pass that exact decision on.'
                    : 'Understood. I won’t agree to that.',
            );
        });

        return a;
    }
}
