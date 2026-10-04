import type { Engine } from './engine.js';
import type { Photon } from '../providers/photon.js';
import { checkVoiceRoute } from '../providers/voice-routing.js';
import { jsonRequest } from '../providers/http.js';

export interface ConnectionCheck {
    name: string;
    status: 'ready' | 'action' | 'unavailable';
    detail: string;
}

export async function checkReadiness(engine: Engine, photon: Photon) {
    const { config, voice, gmail } = engine;
    const checks: ConnectionCheck[] = [];
    let phoneReady = false;
    let voiceReady = false;
    let publicReady = false;

    await Promise.all([
        (async () => {
            try {
                const result = await jsonRequest<{ service: string }>(
                    'Public endpoint',
                    `${config.PUBLIC_URL}/health`,
                );

                publicReady =
                    result.service === 'handle' &&
                    config.PUBLIC_URL.startsWith('https:');
                checks.push({
                    name: 'Public endpoint',
                    status: publicReady ? 'ready' : 'action',
                    detail: publicReady
                        ? 'Voice tools and Gmail callbacks can reach Handle.'
                        : 'A public HTTPS endpoint is required.',
                });
            } catch {
                checks.push({
                    name: 'Public endpoint',
                    status: 'unavailable',
                    detail: 'The public endpoint is not reachable. Keep the server and tunnel running.',
                });
            }
        })(),
        (async () => {
            try {
                await voice.request(
                    `/convai/agents/${config.ELEVENLABS_AGENT_ID}`,
                );
                await voice.request(
                    `/convai/agents/${config.ELEVENLABS_INTAKE_AGENT_ID}`,
                );

                if (!config.ELEVENLABS_VERIFIER_AGENT_ID) {
                    throw new Error('Outcome verifier is not configured.');
                }

                await voice.request(
                    `/convai/agents/${config.ELEVENLABS_VERIFIER_AGENT_ID}`,
                );
                voiceReady = true;
                checks.push({
                    name: 'ElevenLabs',
                    status: 'ready',
                    detail: 'The voice agent, text planner, and outcome verifier are accessible.',
                });
            } catch {
                checks.push({
                    name: 'ElevenLabs',
                    status: 'unavailable',
                    detail: 'Check the API key and agent setup.',
                });
            }
        })(),
        (async () => {
            try {
                await checkVoiceRoute(config, voice, engine.telephony);
                phoneReady = true;
                checks.push({
                    name: 'Phone calling',
                    status: 'ready',
                    detail:
                        config.VOICE_PROVIDER === 'photon'
                            ? 'Photon SIP configuration is connected. Two-way audio still needs a live test.'
                            : 'Connected to an active paid Twilio voice number.',
                });
            } catch (error) {
                checks.push({
                    name: 'Phone calling',
                    status: 'action',
                    detail: (error as Error).message,
                });
            }
        })(),
        (async () => {
            try {
                await jsonRequest(
                    'SpacetimeDB',
                    `${config.SPACETIMEDB_URL}/v1/database/${config.SPACETIMEDB_DATABASE}/sql`,
                    {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${config.SPACETIMEDB_TOKEN}`,
                        },
                        body: 'SELECT COUNT(*) AS cases FROM case_state',
                    },
                );
                checks.push({
                    name: 'SpacetimeDB',
                    status: 'ready',
                    detail: 'Private case storage is accessible.',
                });
            } catch {
                checks.push({
                    name: 'SpacetimeDB',
                    status: 'unavailable',
                    detail: 'Cloud storage is unavailable. Local case data is retained for retry.',
                });
            }
        })(),
    ]);

    checks.push({
        name: 'iMessage',
        status: photon.status === 'connected' ? 'ready' : 'action',
        detail:
            photon.status === 'connected'
                ? photon.lastInboundAt
                    ? 'Connected and an enrolled message has been received.'
                    : 'SDK connected. Enroll your phone under Photon Users, then send the first text to verify delivery.'
                : (photon.lastError ?? 'Save Photon credentials to connect.'),
    });
    checks.push({
        name: 'Gmail',
        status: gmail.connected(config.ALLOWED_SENDERS.split(',')[0])
            ? 'ready'
            : 'action',
        detail: gmail.connected(config.ALLOWED_SENDERS.split(',')[0])
            ? 'Read-only email access is connected.'
            : 'Optional for the first call. Complete Google consent to retrieve email evidence.',
    });

    return {
        voiceProvider: config.VOICE_PROVIDER,
        checkedAt: Date.now(),
        canEnableCalling: phoneReady && voiceReady && publicReady,
        callingEnabled: config.CALLING_ENABLED === 'true',
        checks: checks.sort((a, b) => a.name.localeCompare(b.name)),
    };
}
