import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadConfig } from '../src/config.js';
import { voicePrompt } from '../src/core/prompts.js';
import { phoneTurn } from '../src/core/voice-profile.js';
import { ElevenLabs } from '../src/providers/elevenlabs.js';

// Updates future conversations; never starts a call or interrupts an active one.
const config = loadConfig();
const api = new ElevenLabs(config);
const route = `/convai/agents/${config.ELEVENLABS_AGENT_ID}`;
const current = await api.request<{ conversation_config: Record<string, any> }>(
    route,
);

mkdirSync('.data', { recursive: true });
writeFileSync(
    `.data/conversation-backup-${Date.now()}.json`,
    JSON.stringify(current),
    { mode: 0o600 },
);
await api.request(route, 'PATCH', {
    conversation_config: {
        agent: {
            disable_first_message_interruptions: true,
            prompt: { prompt: voicePrompt },
        },
        turn: phoneTurn,
    },
});

const saved = await api.request<typeof current>(route);

assert.equal(saved.conversation_config.agent.prompt.prompt, voicePrompt);
assert.equal(
    saved.conversation_config.agent.disable_first_message_interruptions,
    true,
);

for (const [key, value] of Object.entries(phoneTurn)) {
    assert.deepEqual(saved.conversation_config.turn[key], value);
}

assert.deepEqual(
    saved.conversation_config.agent.prompt.tool_ids,
    current.conversation_config.agent.prompt.tool_ids,
);
assert.deepEqual(
    saved.conversation_config.tts,
    current.conversation_config.tts,
);
console.log(
    'Verified live conversation recovery and turn settings; voice and tools preserved.',
);
