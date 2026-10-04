import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';
import { ElevenLabs } from '../src/providers/elevenlabs.js';
import { Telephony } from '../src/providers/telephony.js';
import { checkVoiceRoute } from '../src/providers/voice-routing.js';
import type { Case } from '../src/core/model.js';

process.env.DASHBOARD_TOKEN = 'test-token-'.repeat(4);
process.env.ENCRYPTION_KEY = 'ab'.repeat(32);

const c: Case = {
    id: 'test-case',
    owner: '+12025550142',
    spaceId: 'test',
    title: 'Cancel',
    status: 'ready',
    goal: 'Cancel appointment',
    business: 'Salon',
    phone: '+12025550110',
    customerName: 'Alex',
    context: 'Tomorrow at 2pm',
    authorization: 'No fees',
    createdAt: 1,
    updatedAt: 1,
    callToken: 'test-token',
};

function setup() {
    const config = loadConfig();

    Object.assign(config, {
        VOICE_PROVIDER: 'photon',
        PHOTON_VOICE_ENABLED: 'true',
        PHOTON_PROJECT_ID: 'test-project',
        PHOTON_PROJECT_SECRET: 'test-secret',
        PHOTON_VOICE_NUMBER: '+12025550111',
        PHOTON_ELEVENLABS_PHONE_NUMBER_ID: 'photon-number',
        ELEVENLABS_PHONE_NUMBER_ID: 'twilio-number',
        ELEVENLABS_AGENT_ID: 'handle-agent',
    });

    return {
        config,
        voice: new ElevenLabs(config),
        twilio: new Telephony(config),
    };
}

test('Photon SIP and Twilio keep independent number IDs and outbound payloads', async () => {
    const { config, voice } = setup();
    const requests: { path: string; body: any }[] = [];

    voice.request = async <T>(
        path: string,
        _method?: string,
        body?: unknown,
    ) => {
        requests.push({ path, body });

        return {
            success: true,
            conversation_id: 'conversation',
            sip_call_id: 'sip-call',
            callSid: 'twilio-call',
        } as T;
    };

    const sip = await voice.startCall({ ...c, voiceProvider: 'photon' });

    assert.equal(sip.sip_call_id, 'sip-call');
    assert.equal(requests[0].path, '/convai/sip-trunk/outbound-call');
    assert.equal(requests[0].body.agent_phone_number_id, 'photon-number');
    assert.equal(
        requests[0].body.conversation_initiation_client_data.dynamic_variables
            .secret__case_token,
        'test-token',
    );
    assert.equal(requests[0].body.call_recording_enabled, undefined);
    config.VOICE_PROVIDER = 'photon';
    await voice.startCall({ ...c, voiceProvider: 'twilio' });
    assert.equal(requests[1].path, '/convai/twilio/outbound-call');
    assert.equal(requests[1].body.agent_phone_number_id, 'twilio-number');
    assert.equal(requests[1].body.call_recording_enabled, false);
});

test('Photon calling fails closed without entitlement and validates the assigned TLS trunk', async () => {
    const { config, voice, twilio } = setup();

    config.PHOTON_VOICE_ENABLED = 'false';

    let reads = 0;

    voice.request = async <T>() => {
        reads++;

        return {
            provider: 'sip_trunk',
            phone_number: config.PHOTON_VOICE_NUMBER,
            assigned_agent: { agent_id: 'handle-agent' },
            outbound_trunk_config: {
                address: 'sip.spectrum.photon.codes:5061',
                transport: 'tls',
            },
        } as T;
    };

    await assert.rejects(
        () => checkVoiceRoute(config, voice, twilio, c.phone),
        /access must be confirmed/,
    );
    assert.equal(reads, 0);
    config.PHOTON_VOICE_ENABLED = 'true';
    await checkVoiceRoute(config, voice, twilio, c.phone);
    config.ELEVENLABS_AGENT_ID = 'someone-else';
    await assert.rejects(
        () => checkVoiceRoute(config, voice, twilio, c.phone),
        /not connected/,
    );
    await assert.rejects(
        () => checkVoiceRoute(config, voice, twilio, 'invalid'),
        /valid destination/,
    );
});

test('Twilio trial is blocked even when the destination and caller number are valid', async () => {
    const { config, twilio } = setup();

    config.TWILIO_PHONE_NUMBER = '+12025550111';
    twilio.inspect = async () => ({
        type: 'Trial',
        active: true,
        numbers: [{ phoneNumber: config.TWILIO_PHONE_NUMBER }] as any,
    });
    await assert.rejects(
        () => twilio.validateDestination(c.phone),
        /trial accounts block/i,
    );
});
