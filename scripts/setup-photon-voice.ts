import { loadConfig } from '../src/config.js';
import { ElevenLabs } from '../src/providers/elevenlabs.js';
import { saveEnv } from './env.js';

const config = loadConfig();
const connect = process.argv.includes('--connect');
const missing = [
    !config.PHOTON_PROJECT_ID && 'Photon project ID',
    !config.PHOTON_PROJECT_SECRET && 'Photon project secret',
    !/^\+[1-9]\d{7,14}$/.test(config.PHOTON_VOICE_NUMBER) &&
        'project-owned iMessage caller number in PHOTON_VOICE_NUMBER',
    config.PHOTON_VOICE_ENABLED !== 'true' &&
        'Photon confirmation of SIP access (PHOTON_VOICE_ENABLED=true)',
    !config.ELEVENLABS_AGENT_ID && 'Handle ElevenLabs agent',
].filter(Boolean);

console.log('Photon outbound SIP: TLS to sip.spectrum.photon.codes:5061.');
console.log(
    'The caller must be a line owned by this project, not the customer phone enrolled for messaging.',
);

if (missing.length) {
    console.log(
        `Still needed:\n${missing.map((item) => `  - ${item}`).join('\n')}`,
    );
}

if (!connect) {
    console.log(
        'Preflight only. No credentials shared, number imported, plan changed, or call placed.',
    );
    process.exit(0);
}

if (missing.length) {
    throw new Error('Complete the preflight requirements before connecting.');
}

const voice = new ElevenLabs(config);
const phones = await voice.request<
    {
        phone_number: string;
        phone_number_id: string;
        provider: string;
        assigned_agent?: { agent_id: string };
    }[]
>('/convai/phone-numbers');
const existing = phones.find(
    (phone) => phone.phone_number === config.PHOTON_VOICE_NUMBER,
);

if (
    existing &&
    (existing.provider !== 'sip_trunk' ||
        (existing.assigned_agent &&
            existing.assigned_agent.agent_id !== config.ELEVENLABS_AGENT_ID))
) {
    throw new Error(
        'This number already belongs to a different provider or agent. Its configuration was not changed.',
    );
}

const body = {
    provider: 'sip_trunk',
    phone_number: config.PHOTON_VOICE_NUMBER,
    label: 'Handle · Photon',
    agent_id: config.ELEVENLABS_AGENT_ID,
    outbound_trunk_config: {
        address: 'sip.spectrum.photon.codes:5061',
        transport: 'tls',
        media_encryption: 'allowed',
        enabled_codecs: ['PCMU/8000'],
        credentials: {
            username: config.PHOTON_PROJECT_ID,
            password: config.PHOTON_PROJECT_SECRET,
        },
    },
};

// --connect explicitly installs the project's SIP credentials in ElevenLabs.
const id =
    existing?.phone_number_id ??
    (
        await voice.request<{ phone_number_id: string }>(
            '/convai/phone-numbers',
            'POST',
            body,
        )
    ).phone_number_id;

if (existing) {
    await voice.request(
        `/convai/phone-numbers/${encodeURIComponent(id)}`,
        'PATCH',
        {
            agent_id: body.agent_id,
            outbound_trunk_config: body.outbound_trunk_config,
        },
    );
}

saveEnv({ PHOTON_ELEVENLABS_PHONE_NUMBER_ID: id, CALLING_ENABLED: 'false' });
console.log(
    'Photon SIP connected to Handle. Twilio settings were preserved. Restart Handle, select Photon in Connections, and check readiness. Calling remains paused.',
);
