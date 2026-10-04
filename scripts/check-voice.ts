import { loadConfig } from '../src/config.js';
import type { Case, CaseEvent } from '../src/core/model.js';
import { ElevenLabs } from '../src/providers/elevenlabs.js';
import { Telephony } from '../src/providers/telephony.js';
import { jsonRequest } from '../src/providers/http.js';

async function main() {
    const config = loadConfig();
    const state = await jsonRequest<{
        cases: Case[];
        events: CaseEvent[];
        queues: { messages: { pending: number; retrying: number } };
    }>('Handle', `http://127.0.0.1:${config.PORT}/api/state`, {
        headers: { Authorization: `Bearer ${config.DASHBOARD_TOKEN}` },
    });
    const selectedId = process.argv[2];
    const c = state.cases
        .filter((c) => c.mode !== 'rehearsal' && c.conversationId)
        .sort((a, b) => b.createdAt - a.createdAt)
        .find((c) => !selectedId || c.id === selectedId);

    if (!c?.conversationId) {
        throw new Error(
            'No telephone conversation found. Make a consenting test call first.',
        );
    }

    const conversation = await new ElevenLabs(config).conversation(
        c.conversationId,
    );
    const transcript =
        conversation.transcript?.filter((line) => line.message?.trim()) ?? [];
    const stored = state.events.filter(
        (event) => event.caseId === c.id && event.kind === 'transcript',
    );
    const checks: [string, boolean][] = [
        ['ElevenLabs conversation finished', conversation.status === 'done'],
        [
            'Agent and recipient both spoke',
            ['agent', 'user'].every((role) =>
                transcript.some((line) => line.role === role),
            ),
        ],
        [
            'Transcript saved in Handle',
            transcript.length > 0 &&
                stored.length === transcript.length &&
                (conversation.transcript ?? []).every((line, index) => {
                    if (!line.message?.trim()) {
                        return true;
                    }

                    const event = stored.find(
                        (event) =>
                            event.id ===
                            `transcript:${c.conversationId}:${index}`,
                    );

                    return (
                        event?.text === line.message &&
                        event.actor ===
                            (line.role === 'agent' ? 'handle' : 'business')
                    );
                }),
        ],
        [
            'Requested outcome confirmed',
            c.mode === 'demo'
                ? c.status === 'completed'
                : c.status === 'resolved' && Boolean(c.confirmedAt),
        ],
        [
            'Completion notification recorded',
            state.events.some((event) => event.id === `out:result:${c.id}`),
        ],
        [
            'Message delivery queue empty',
            state.queues.messages.pending === 0 &&
                state.queues.messages.retrying === 0,
        ],
    ];

    if (c.voiceProvider === 'twilio' && c.callSid) {
        checks.push([
            'Twilio call completed',
            (await new Telephony(config).callStatus(c.callSid)) === 'completed',
        ]);
    }

    console.log(`Latest ${c.mode === 'demo' ? 'demo' : 'task'} call: ${c.id}`);
    console.log(
        `Duration: ${conversation.metadata?.call_duration_secs ?? 'unknown'} seconds; transcript turns: ${transcript.length}`,
    );

    for (const [name, passed] of checks) {
        console.log(`${passed ? 'PASS' : 'WAIT'} ${name}`);
    }

    if (checks.some(([, passed]) => !passed)) {
        process.exitCode = 1;
    }

    console.log(
        'Read-only check: no calls or texts sent. Confirm audible quality with the recipient.',
    );
}

void main().catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
});
