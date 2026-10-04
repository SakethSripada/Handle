import test from 'node:test';
import assert from 'node:assert/strict';
import { callMetrics } from '../src/core/call-metrics.js';

test('latency summaries use reported agent metrics, reject invalid values and preserve missing data', () => {
    const metrics = callMetrics({
        conversation_id: 'test',
        status: 'done',
        metadata: { call_duration_secs: 60 },
        transcript: [
            ...[0.1, 0.3, 0.2, 0.4, NaN, -1].map((value) => ({
                role: 'agent',
                conversation_turn_metrics: {
                    metrics: {
                        convai_ttf_audio_since_silence: { elapsed_time: value },
                    },
                },
            })),
            {
                role: 'user',
                conversation_turn_metrics: {
                    metrics: {
                        convai_ttf_audio_since_silence: { elapsed_time: 99 },
                    },
                },
            },
        ],
    });

    assert.deepEqual(metrics.agentAudio, {
        samples: 4,
        medianMs: 250,
        p95Ms: 400,
    });
    assert.equal(metrics.llmFirstToken, undefined);
    assert.equal(metrics.durationSeconds, 60);
    assert.equal(
        callMetrics({ conversation_id: 'empty', status: 'done' }).agentAudio,
        undefined,
    );
});
