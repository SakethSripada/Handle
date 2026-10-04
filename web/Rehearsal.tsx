import { useEffect, useRef, useState } from 'react';
import type { Conversation } from '@elevenlabs/client';
import { Mic, Square } from 'lucide-react';
import { request } from './types.js';

export function Rehearsal({
    caseId,
    onStarted,
    onError,
}: {
    caseId: string;
    onStarted: (id: string) => void;
    onError: (error: string) => void;
}) {
    const session = useRef<Conversation | null>(null);
    const [status, setStatus] = useState('idle');

    useEffect(
        () => () => {
            void session.current?.endSession();
        },
        [],
    );

    async function start() {
        setStatus('connecting');

        let id: string | undefined;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });

            stream.getTracks().forEach((track) => track.stop());

            const data = await request<{
                caseId: string;
                signedUrl: string;
                dynamicVariables: Record<string, string>;
            }>(`/cases/${caseId}/rehearse`, {});

            id = data.caseId;
            onStarted(id);

            const report = (event: unknown) => {
                void request(
                    `/cases/${data.caseId}/rehearsal-event`,
                    event,
                ).catch((error) => onError(error.message));
            };

            const { Conversation } = await import('@elevenlabs/client');

            session.current = await Conversation.startSession({
                signedUrl: data.signedUrl,
                connectionType: 'websocket',
                dynamicVariables: data.dynamicVariables,
                onConnect: ({ conversationId }) => {
                    setStatus('listening');
                    report({ conversationId });
                },
                onModeChange: ({ mode }) => setStatus(mode),
                onMessage: (message) =>
                    report({
                        role: message.role,
                        message: message.message,
                        eventId: String(message.event_id),
                    }),
                onDisconnect: () => {
                    setStatus('idle');
                    session.current = null;
                    report({ ended: true });
                },
                onError: (message) => onError(message),
            });
        } catch (error) {
            setStatus('idle');
            onError((error as Error).message);

            if (id) {
                await request(`/cases/${id}/rehearsal-event`, { ended: true });
            }
        }
    }

    return (
        <div className="rehearsal">
            <div>
                <Mic size={18} />
                <span>
                    <strong>Try the conversation</strong>
                    <small>
                        You play the business. Handle does the talking.
                    </small>
                </span>
            </div>
            <button
                disabled={status === 'connecting'}
                onClick={() =>
                    void (status === 'idle'
                        ? start()
                        : session.current?.endSession())
                }
            >
                {status === 'idle' ? (
                    <>
                        <Mic size={13} /> Browser rehearsal
                    </>
                ) : (
                    <>
                        <Square size={12} />
                        {status === 'connecting'
                            ? 'Connecting…'
                            : `End · ${status}`}
                    </>
                )}
            </button>
        </div>
    );
}
