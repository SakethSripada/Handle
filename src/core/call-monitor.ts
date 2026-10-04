import { setTimeout as delay } from 'node:timers/promises';
import { verifyOutcome } from './outcome-verification.js';
import { callMetrics } from './call-metrics.js';
import type { Engine } from './engine.js';
import type { Conversation } from '../providers/elevenlabs.js';

export class CallMonitor {
    private verifying = new Set<string>();
    constructor(private engine: Engine) {}

    private async verifyText(prompt: string) {
        try {
            return await this.engine.text.verify(prompt);
        } catch (error) {
            if (this.engine.text.provider === 'gemini') {
                throw error;
            }

            // A finished voice session may still occupy the provider's concurrency slot.
            await delay(1500);

            return this.engine.text.verify(prompt);
        }
    }

    async poll() {
        for (const c of this.engine.store
            .cases()
            .filter(
                (c) =>
                    c.conversationId &&
                    !this.engine.store.get('call-finalized', c.conversationId),
            )) {
            try {
                await this.apply(
                    c.id,
                    await this.engine.voice.conversation(c.conversationId!),
                );
            } catch (error) {
                console.warn(
                    'Call status unavailable:',
                    (error as Error).message,
                );
            }
        }
    }

    async apply(id: string, data: Conversation) {
        const { store } = this.engine;
        const c = store.case(id);

        if (!c || data.conversation_id !== c.conversationId) {
            return;
        }

        const browserTranscript =
            c.mode === 'rehearsal' &&
            store
                .events(c.id)
                .some(
                    (event) =>
                        event.kind === 'transcript' &&
                        event.id.startsWith('browser:'),
                );

        for (const [index, line] of (browserTranscript
            ? []
            : (data.transcript ?? [])
        ).entries()) {
            if (line.message) {
                store.event(
                    c.id,
                    'transcript',
                    line.role === 'agent' ? 'handle' : 'business',
                    line.message,
                    `transcript:${data.conversation_id}:${index}`,
                );
            }
        }

        if (data.status === 'in-progress' && c.status === 'dialing') {
            store.saveCase({ ...c, status: 'in_call' });
        }

        if (
            !['done', 'failed'].includes(data.status) ||
            this.verifying.has(id) ||
            store.get('call-finalized', data.conversation_id)
        ) {
            return;
        }

        c.callMetrics = callMetrics(data);
        store.saveCase({ ...c, callToken: undefined });

        if (c.mode === 'demo') {
            const stopped = c.stopRequestedAt || c.status === 'cancelled';
            const replied = data.transcript?.some(
                (line) => line.role === 'user' && line.message?.trim(),
            );
            const completed = data.status === 'done' && replied;
            const outcome = stopped
                ? 'The demo call has ended. Your stop request is confirmed.'
                : completed
                  ? 'Demo call finished. The conversation transcript is available in Handle.'
                  : 'The demo ended without a confirmed conversation. Check the transcript before trying again.';

            store.transaction(() => {
                store.saveCase({
                    ...c,
                    status: stopped
                        ? 'cancelled'
                        : completed
                          ? 'completed'
                          : 'failed',
                    callToken: undefined,
                    memoryExcluded: true,
                    outcome,
                });
                store.event(c.id, 'status', 'system', outcome);
                this.engine.notify(c, outcome, `result:${c.id}`);
                store.put('call-finalized', data.conversation_id, true);
            });

            return;
        }

        if (
            c.proposedOutcome &&
            data.status === 'done' &&
            !c.stopRequestedAt &&
            c.status !== 'cancelled'
        ) {
            this.verifying.add(id);
            store.saveCase({ ...c, status: 'verifying', callToken: undefined });

            try {
                const verdict = await verifyOutcome(
                    (prompt) => this.verifyText(prompt),
                    c,
                    data.transcript ?? [],
                    store.approvals(c.id),
                );
                const latest = store.case(id)!;

                if (latest.status === 'cancelled') {
                    return;
                }

                const pending = store
                    .approvals(c.id)
                    .some((a) => a.status === 'pending');
                const resolved =
                    verdict.resolved && !pending && !latest.stopRequestedAt;
                const outcome = resolved
                    ? `${verdict.summary}\nConfirmation: ${verdict.confirmation}`
                    : `No verified resolution. ${verdict.reason}`;

                store.saveCase({
                    ...latest,
                    status: latest.stopRequestedAt
                        ? 'cancelled'
                        : resolved
                          ? 'resolved'
                          : 'follow_up',
                    outcome,
                    confirmation: resolved ? verdict.confirmation : undefined,
                    confirmedAt: resolved ? Date.now() : undefined,
                    callToken: undefined,
                });
                store.event(c.id, 'status', 'system', outcome);
                this.engine.notify(
                    c,
                    `${resolved ? 'Handled.' : 'The call ended; this needs a follow-up.'} ${outcome}`,
                    `result:${c.id}`,
                );
            } catch (error) {
                store.event(
                    id,
                    'error',
                    'system',
                    `Outcome verification unavailable: ${(error as Error).message}`,
                );

                if (store.case(id)?.status === 'cancelled') {
                    return;
                }

                store.saveCase({
                    ...store.case(id)!,
                    status: 'follow_up',
                    callToken: undefined,
                    outcome:
                        'The call ended, but its outcome could not be verified. Review the transcript before taking further action.',
                });
                this.engine.notify(
                    c,
                    'The call ended, but I couldn’t verify its outcome. I won’t claim it was resolved or call again automatically.',
                    `result:${c.id}`,
                );
            } finally {
                this.verifying.delete(id);
                store.put('call-finalized', data.conversation_id, true);
            }

            return;
        }

        store.put('call-finalized', data.conversation_id, true);

        if (
            ['dialing', 'in_call', 'waiting_approval', 'verifying'].includes(
                c.status,
            )
        ) {
            const summary =
                data.analysis?.transcript_summary ??
                'The call ended without a confirmed outcome.';

            store.saveCase({
                ...c,
                status: c.stopRequestedAt
                    ? 'cancelled'
                    : data.status === 'failed'
                      ? 'failed'
                      : 'follow_up',
                outcome: c.stopRequestedAt
                    ? 'The call ended after your stop request.'
                    : summary,
                callToken: undefined,
            });
            this.engine.notify(
                c,
                c.stopRequestedAt
                    ? 'The call has ended. Your stop request is confirmed.'
                    : `The call ended. ${summary}\nI don’t have a confirmed resolution yet.`,
                `result:${c.id}`,
            );
        }
    }
}
