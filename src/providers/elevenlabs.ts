import WebSocket from 'ws';
import type { Config } from '../config.js';
import type { Case } from '../core/model.js';
import { voiceNumberId } from './voice-routing.js';
import { jsonRequest } from './http.js';
import { callVariables } from '../core/demo.js';

export interface Conversation {
    conversation_id: string;
    status: string;
    transcript?: {
        role: string;
        message?: string;
        time_in_call_secs?: number;
        conversation_turn_metrics?: {
            metrics?: Record<string, { elapsed_time: number }>;
        };
    }[];
    metadata?: { call_duration_secs?: number };
    analysis?: { transcript_summary?: string; call_successful?: string };
}

export class ElevenLabs {
    constructor(private config: Config) {}

    request<T>(path: string, method = 'GET', body?: unknown) {
        if (!this.config.ELEVENLABS_API_KEY) {
            throw new Error('ElevenLabs API key is not configured.');
        }

        return jsonRequest<T>(
            'ElevenLabs',
            `https://api.elevenlabs.io/v1${path}`,
            {
                method,
                headers: {
                    'xi-api-key': this.config.ELEVENLABS_API_KEY,
                    'Content-Type': 'application/json',
                },
                ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            },
        );
    }

    async startCall(c: Case) {
        const provider = c.voiceProvider ?? this.config.VOICE_PROVIDER;
        const phoneId = voiceNumberId(this.config, provider);

        if (!phoneId) {
            throw new Error(
                'Phone calling is paused until a sender number is connected.',
            );
        }

        const result = await this.request<{
            success: boolean;
            message: string;
            conversation_id: string;
            callSid?: string;
            sip_call_id?: string;
        }>(
            provider === 'photon'
                ? '/convai/sip-trunk/outbound-call'
                : '/convai/twilio/outbound-call',
            'POST',
            {
                agent_id: this.config.ELEVENLABS_AGENT_ID,
                agent_phone_number_id: phoneId,
                to_number: c.phone,
                ...(provider === 'twilio'
                    ? { call_recording_enabled: false }
                    : {}),
                conversation_initiation_client_data: {
                    dynamic_variables: callVariables(c),
                },
            },
        );

        if (!result.success) {
            throw new Error(result.message || 'The call could not be started.');
        }

        return result;
    }

    conversation(id: string) {
        return this.request<Conversation>(
            `/convai/conversations/${encodeURIComponent(id)}`,
        );
    }

    async text(
        prompt: string,
        id = this.config.ELEVENLABS_INTAKE_AGENT_ID,
        timeoutMs = 45000,
    ): Promise<string> {
        if (!id) {
            throw new Error('The intake agent has not been configured.');
        }

        const { signed_url } = await this.request<{ signed_url: string }>(
            `/convai/conversation/get_signed_url?agent_id=${encodeURIComponent(id)}`,
        );

        return new Promise((resolve, reject) => {
            const ws = new WebSocket(signed_url);
            let done = false;
            let sent = false;
            const finish = (error?: Error, value?: string) => {
                if (done) {
                    return;
                }

                done = true;
                clearTimeout(timer);
                ws.close();
                error ? reject(error) : resolve(value!);
            };

            const timer = setTimeout(
                () =>
                    finish(
                        new Error('The intake agent took too long to respond.'),
                    ),
                timeoutMs,
            );

            ws.on('open', () =>
                ws.send(
                    JSON.stringify({
                        type: 'conversation_initiation_client_data',
                    }),
                ),
            );
            ws.on('message', (raw) => {
                try {
                    const msg = JSON.parse(raw.toString());

                    if (msg.type === 'ping') {
                        ws.send(
                            JSON.stringify({
                                type: 'pong',
                                event_id: msg.ping_event.event_id,
                            }),
                        );
                    }

                    if (
                        msg.type === 'conversation_initiation_metadata' &&
                        !sent
                    ) {
                        sent = true;
                        ws.send(
                            JSON.stringify({
                                type: 'user_message',
                                text: prompt,
                            }),
                        );
                    }

                    if (msg.type === 'agent_response' && sent) {
                        finish(
                            undefined,
                            msg.agent_response_event.agent_response,
                        );
                    }

                    if (msg.type === 'error') {
                        finish(new Error('ElevenLabs conversation error.'));
                    }
                } catch (error) {
                    finish(error as Error);
                }
            });
            ws.on('error', (error) => finish(error));
            ws.on('close', () => {
                if (!done) {
                    finish(
                        new Error(
                            'Intake connection closed before a response.',
                        ),
                    );
                }
            });
        });
    }
}
