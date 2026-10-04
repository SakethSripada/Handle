import { loadConfig } from '../src/config.js';
import { ElevenLabs } from '../src/providers/elevenlabs.js';
import { Telephony } from '../src/providers/telephony.js';
import { saveEnv } from './env.js';

const config = loadConfig();
const twilio = new Telephony(config);
const info = await twilio.inspect();

if (!info.active) {
    throw new Error('Twilio is not active.');
}

if (!info.numbers.length) {
    throw new Error(
        'No owned Twilio voice number is available. The Try out Voice demo number cannot be imported. Obtain an eligible number in Twilio first; this script never purchases one.',
    );
}

const number = config.TWILIO_PHONE_NUMBER
    ? info.numbers.find(
          (number) => number.phoneNumber === config.TWILIO_PHONE_NUMBER,
      )
    : info.numbers.length === 1
      ? info.numbers[0]
      : undefined;

if (!number) {
    throw new Error(
        'Set TWILIO_PHONE_NUMBER to the owned voice number intended for Handle.',
    );
}

if (!process.argv.includes('--connect')) {
    console.log(
        `Found an eligible voice number. Account type: ${info.type}. Run with --connect to import it into ElevenLabs. No call has been made.`,
    );
    process.exit(0);
}

if (!config.ELEVENLABS_AGENT_ID) {
    throw new Error('Configure the Handle voice agent first.');
}

const voice = new ElevenLabs(config);
const existing = await voice.request<
    {
        phone_number: string;
        phone_number_id: string;
        assigned_agent?: { agent_id: string };
    }[]
>('/convai/phone-numbers');
const linked = existing.find(
    (phone) => phone.phone_number === number.phoneNumber,
);

if (
    linked?.assigned_agent &&
    linked.assigned_agent.agent_id !== config.ELEVENLABS_AGENT_ID
) {
    throw new Error(
        'This number belongs to another ElevenLabs agent. Choose a number intended for Handle.',
    );
}

const id =
    linked?.phone_number_id ??
    (
        await voice.request<{ phone_number_id: string }>(
            '/convai/phone-numbers',
            'POST',
            {
                provider: 'twilio',
                phone_number: number.phoneNumber,
                label: 'Handle',
                sid: config.TWILIO_ACCOUNT_SID,
                token: config.TWILIO_AUTH_TOKEN,
                agent_id: config.ELEVENLABS_AGENT_ID,
                enable_sms: false,
            },
        )
    ).phone_number_id;

if (linked && !linked.assigned_agent) {
    await voice.request(`/convai/phone-numbers/${id}`, 'PATCH', {
        agent_id: config.ELEVENLABS_AGENT_ID,
    });
}

saveEnv({
    TWILIO_PHONE_NUMBER: number.phoneNumber,
    ELEVENLABS_PHONE_NUMBER_ID: id,
    CALLING_ENABLED: 'false',
});
console.log(
    'Voice number connected. Calling remains paused. Restart Handle, check connections, then explicitly enable calling for a test.',
);
