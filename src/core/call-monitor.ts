import { callMetrics } from './call-metrics.js';
import type { Engine } from './engine.js';
import type { Conversation } from '../providers/elevenlabs.js';

export class CallMonitor {
    constructor(private engine: Engine) {}

    async poll() {
        for (const c of this.engine.store
            .cases()
            .filter(
                (c) =>
                    c.conversationId &&
                    !this.engine.store.get('call-finalized', c.conversationId),
            )) {
            try {
                this.apply(
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

    apply(id: string, data: Conversation) {
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

        if (['done', 'failed'].includes(data.status)) {
            c.callMetrics = callMetrics(data);
            store.put('call-finalized', data.conversation_id, true);
            store.saveCase({ ...c, callToken: undefined });
        }

        if (
            ['done', 'failed'].includes(data.status) &&
            ['dialing', 'in_call', 'waiting_approval'].includes(c.status)
        ) {
            // Post-call analysis is evidence, not proof that the user's requested action succeeded.
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
