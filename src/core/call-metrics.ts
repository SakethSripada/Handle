import type { Conversation } from '../providers/elevenlabs.js';

export interface LatencySummary {
    samples: number;
    medianMs: number;
    p95Ms: number;
}

export interface CallMetrics {
    durationSeconds?: number;
    agentAudio?: LatencySummary;
    llmFirstToken?: LatencySummary;
}

function summarize(values: number[]): LatencySummary | undefined {
    const sorted = values
        .filter((n) => Number.isFinite(n) && n >= 0)
        .sort((a, b) => a - b);

    if (!sorted.length) {
        return undefined;
    }

    const median =
        sorted.length % 2
            ? sorted[Math.floor(sorted.length / 2)]
            : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;

    return {
        samples: sorted.length,
        medianMs: Math.round(median * 1000),
        p95Ms: Math.round(sorted[Math.ceil(sorted.length * 0.95) - 1] * 1000),
    };
}

export function callMetrics(conversation: Conversation): CallMetrics {
    const values = (name: string) =>
        (conversation.transcript ?? [])
            .filter((turn) => turn.role === 'agent')
            .flatMap((turn) => {
                const value =
                    turn.conversation_turn_metrics?.metrics?.[name]
                        ?.elapsed_time;

                return typeof value === 'number' ? [value] : [];
            });

    return {
        durationSeconds: conversation.metadata?.call_duration_secs,
        agentAudio: summarize(values('convai_ttf_audio_since_silence')),
        llmFirstToken: summarize(values('convai_llm_service_ttfb')),
    };
}
