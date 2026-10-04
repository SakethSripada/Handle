import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { loadConfig } from '../src/config.js';
import type { Case } from '../src/core/model.js';
import { voicePrompt } from '../src/core/prompts.js';
import { phoneVoice } from '../src/core/voice-profile.js';
import { ElevenLabs } from '../src/providers/elevenlabs.js';
import { jsonRequest } from '../src/providers/http.js';

interface VoiceConfig {
    tts: Record<string, unknown>;
    agent: {
        prompt: { prompt: string; [key: string]: unknown };
        [key: string]: unknown;
    };
    [key: string]: unknown;
}

interface Backup {
    agentId: string;
    savedAt: string;
    conversation_config: VoiceConfig;
}

async function main() {
    const restore = process.argv.includes('--restore');
    const config = loadConfig();
    const api = new ElevenLabs(config);
    const path = '.data/voice-quality-backup.json';
    const route = `/convai/agents/${config.ELEVENLABS_AGENT_ID}`;
    const state = await jsonRequest<{ cases: Case[] }>(
        'Handle',
        `http://127.0.0.1:${config.PORT}/api/state`,
        { headers: { Authorization: `Bearer ${config.DASHBOARD_TOKEN}` } },
    );

    if (
        state.cases.some(
            (c) =>
                c.mode !== 'rehearsal' &&
                ['dialing', 'in_call', 'waiting_approval'].includes(c.status),
        )
    ) {
        throw new Error('Finish active calls before tuning the voice.');
    }

    const current = await api.request<{ conversation_config: VoiceConfig }>(
        route,
    );
    const previous: VoiceConfig = {
        tts: current.conversation_config.tts,
        agent: {
            prompt: { prompt: current.conversation_config.agent.prompt.prompt },
        },
    };
    let target: VoiceConfig;

    if (restore) {
        const backup = JSON.parse(readFileSync(path, 'utf8')) as Backup;

        if (backup.agentId !== config.ELEVENLABS_AGENT_ID) {
            throw new Error('The backup belongs to a different voice agent.');
        }

        target = backup.conversation_config;
    } else {
        mkdirSync('.data', { recursive: true });

        if (!existsSync(path)) {
            writeFileSync(
                path,
                JSON.stringify(
                    {
                        agentId: config.ELEVENLABS_AGENT_ID,
                        savedAt: new Date().toISOString(),
                        conversation_config: previous,
                    } satisfies Backup,
                    null,
                    2,
                ),
                { mode: 0o600, flag: 'wx' },
            );
        }

        target = {
            tts: phoneVoice,
            agent: { prompt: { prompt: voicePrompt } },
        };
    }

    try {
        await api.request(route, 'PATCH', { conversation_config: target });

        const saved = await api.request<{ conversation_config: VoiceConfig }>(
            route,
        );
        const actual = saved.conversation_config;
        const matches = Object.entries(target.tts).every(
            ([key, value]) =>
                JSON.stringify(actual.tts[key]) === JSON.stringify(value),
        );

        if (
            !matches ||
            actual.agent.prompt.prompt !== target.agent.prompt.prompt
        ) {
            throw new Error(
                'ElevenLabs did not retain the requested voice settings.',
            );
        }
    } catch (error) {
        await api.request(route, 'PATCH', {
            conversation_config: previous,
        });
        throw error;
    }

    console.log(
        `${restore ? 'Restored' : 'Applied'} voice: ${target.tts.model_id}.`,
    );
    console.log(
        'Phone transport, tools, privacy, and approval rules are preserved.',
    );
    console.log('Rollback: npm run tune:voice -- --restore');
}

main().catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
});
