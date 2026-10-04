import type { Config } from '../config.js';
import { normalizePhone } from '../core/intake.js';
import type { ElevenLabs } from './elevenlabs.js';
import type { Telephony } from './telephony.js';

export type VoiceProvider = 'twilio' | 'photon';

export function voiceNumberId(
    config: Config,
    provider = config.VOICE_PROVIDER,
) {
    return provider === 'photon'
        ? config.PHOTON_ELEVENLABS_PHONE_NUMBER_ID
        : config.ELEVENLABS_PHONE_NUMBER_ID;
}

export async function checkVoiceRoute(
    config: Config,
    voice: ElevenLabs,
    twilio: Telephony,
    destination?: string,
) {
    if (destination && normalizePhone(destination) !== destination) {
        throw new Error('A valid destination number is required.');
    }

    if (config.VOICE_PROVIDER === 'photon') {
        if (config.PHOTON_VOICE_ENABLED !== 'true') {
            throw new Error(
                'Photon SIP access must be confirmed for an owned iMessage line. Phone verification alone does not enable voice.',
            );
        }

        if (
            !config.PHOTON_PROJECT_ID ||
            !config.PHOTON_PROJECT_SECRET ||
            !config.PHOTON_VOICE_NUMBER
        ) {
            throw new Error(
                'Configure the Photon project credentials and owned voice line.',
            );
        }
    } else if (destination) {
        await twilio.validateDestination(destination);
    } else {
        const info = await twilio.inspect();

        if (
            !info.active ||
            !info.numbers.some(
                (n) => n.phoneNumber === config.TWILIO_PHONE_NUMBER,
            )
        ) {
            throw new Error('Connect an active, owned Twilio voice number.');
        }

        if (info.type === 'Trial') {
            throw new Error(
                'Twilio trial accounts block ElevenLabs audio streaming. A paid account is required.',
            );
        }
    }

    if (config.VOICE_PROVIDER === 'twilio') {
        await twilio.checkUsCalling();
    }

    const id = voiceNumberId(config);

    if (!id) {
        throw new Error(
            `Connect the ${config.VOICE_PROVIDER === 'photon' ? 'Photon SIP' : 'Twilio'} line to ElevenLabs first.`,
        );
    }

    const linked = await voice.request<{
        provider: string;
        phone_number: string;
        assigned_agent?: { agent_id: string };
        outbound_trunk_config?: { address: string; transport: string };
    }>(`/convai/phone-numbers/${encodeURIComponent(id)}`);
    const photon = config.VOICE_PROVIDER === 'photon';
    const number = photon
        ? config.PHOTON_VOICE_NUMBER
        : config.TWILIO_PHONE_NUMBER;

    if (
        linked.phone_number !== number ||
        linked.assigned_agent?.agent_id !== config.ELEVENLABS_AGENT_ID ||
        linked.provider !== (photon ? 'sip_trunk' : 'twilio')
    ) {
        throw new Error(
            'The selected line is not connected to the Handle agent and provider.',
        );
    }

    if (
        photon &&
        (linked.outbound_trunk_config?.address !==
            'sip.spectrum.photon.codes:5061' ||
            linked.outbound_trunk_config?.transport !== 'tls')
    ) {
        throw new Error(
            'The Photon outbound trunk must use sip.spectrum.photon.codes:5061 over TLS.',
        );
    }
}
