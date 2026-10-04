import { useState } from 'react';
import { Check, Phone, Headphones } from 'lucide-react';
import { CallMemory } from './CallMemory.js';
import { Rehearsal } from './Rehearsal.js';
import { request, statusLabels, type State, type Case } from './types.js';

interface Props {
    c?: Case;
    state: State;
    busy: boolean;
    action: (fn: () => Promise<unknown>) => Promise<void>;
    send: (text: string) => Promise<void>;
    setSelected: (id: string) => void;
    setError: (error: string) => void;
}

export function CaseDetail({
    c,
    state,
    busy,
    action,
    send,
    setSelected,
    setError,
}: Props) {
    const [tab, setTab] = useState('activity');
    const timeline = state.events.filter(
        (e) =>
            e.caseId === c?.id &&
            (tab === 'transcript'
                ? e.kind === 'transcript'
                : e.kind !== 'transcript' && e.kind !== 'message'),
    );

    return (
        <section className="detail-panel">
            {c ? (
                <>
                    <div className="detail-top">
                        <span className={`status ${c.status}`}>
                            <span className="dot" />
                            {statusLabels[c.status]}
                        </span>
                        <span className="case-ref">
                            #{c.id.slice(0, 6).toUpperCase()}
                        </span>
                    </div>
                    <h2>{c.title}</h2>
                    <p className="goal">
                        {c.goal || 'Tell Handle what you need help with.'}
                    </p>
                    <div className="case-facts">
                        <div>
                            <small>BUSINESS</small>
                            <span>{c.business || 'Not provided yet'}</span>
                        </div>
                        <div>
                            <small>CALLING FOR</small>
                            <span>{c.customerName || 'Not provided yet'}</span>
                        </div>
                    </div>
                    {c.outcome && (
                        <div className="outcome">
                            <Check size={19} />
                            <p>{c.outcome}</p>
                        </div>
                    )}
                    {c.status === 'ready' && (
                        <div className="ready-banner">
                            <Phone size={18} />
                            <span>
                                {state.services.calling
                                    ? 'Everything is ready.'
                                    : 'Request ready. Phone calling is paused.'}
                            </span>
                            <button
                                disabled={!state.services.calling || busy}
                                onClick={() =>
                                    void action(() =>
                                        request(`/cases/${c.id}/start`, {}),
                                    )
                                }
                            >
                                Start call
                            </button>
                        </div>
                    )}
                    {state.approvals
                        .filter(
                            (a) =>
                                a.caseId === c.id &&
                                a.status === 'pending' &&
                                a.expiresAt > Date.now(),
                        )
                        .map((a) => (
                            <div
                                className="decision"
                                key={a.id}
                            >
                                <small>ONE DECISION FOR YOU</small>
                                <p>{a.question}</p>
                                <div>
                                    <button
                                        onClick={() =>
                                            void action(() =>
                                                send(`YES ${a.id}`),
                                            )
                                        }
                                    >
                                        Approve
                                    </button>
                                    <button
                                        onClick={() =>
                                            void action(() =>
                                                send(`NO ${a.id}`),
                                            )
                                        }
                                    >
                                        Decline
                                    </button>
                                </div>
                            </div>
                        ))}
                    <Rehearsal
                        caseId={c.id}
                        onStarted={setSelected}
                        onError={setError}
                    />
                    <div className="tabs">
                        <button
                            className={tab === 'activity' ? 'selected' : ''}
                            onClick={() => setTab('activity')}
                        >
                            Activity
                        </button>
                        <button
                            className={tab === 'transcript' ? 'selected' : ''}
                            onClick={() => setTab('transcript')}
                        >
                            Call transcript
                        </button>
                        <button
                            className={tab === 'context' ? 'selected' : ''}
                            onClick={() => setTab('context')}
                        >
                            Context
                        </button>
                    </div>
                    {tab === 'context' ? (
                        <div className="context">
                            <h4>What we know</h4>
                            <p>{c.context || 'Still gathering the details.'}</p>
                            <h4>What you’ve authorized</h4>
                            <p>
                                {c.authorization || 'No action authorized yet.'}
                            </p>
                            <CallMemory c={c} />
                        </div>
                    ) : (
                        <div className="timeline">
                            {timeline.length ? (
                                timeline.map((e) => (
                                    <div
                                        key={e.id}
                                        className="timeline-item"
                                    >
                                        <span
                                            className={`timeline-dot ${e.kind}`}
                                        />
                                        <div>
                                            <small>
                                                {e.actor === 'business'
                                                    ? 'Business'
                                                    : e.actor === 'handle'
                                                      ? 'Handle'
                                                      : 'System'}{' '}
                                                <time>
                                                    {new Date(
                                                        e.at,
                                                    ).toLocaleTimeString([], {
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </time>
                                            </small>
                                            <p>{e.text}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="empty-timeline">
                                    <Headphones size={25} />
                                    <p>
                                        {tab === 'transcript'
                                            ? 'The conversation will appear here.'
                                            : 'We’re getting your request ready.'}
                                    </p>
                                    <small>
                                        {tab === 'transcript'
                                            ? 'The full transcript is available after the call.'
                                            : 'Meaningful updates appear as the case moves forward.'}
                                    </small>
                                </div>
                            )}
                        </div>
                    )}
                    {['dialing', 'in_call', 'waiting_approval'].includes(
                        c.status,
                    ) && (
                        <button
                            className="stop"
                            disabled={busy || Boolean(c.stopRequestedAt)}
                            onClick={() =>
                                void action(() =>
                                    request(`/cases/${c.id}/stop`, {}),
                                )
                            }
                        >
                            {c.stopRequestedAt
                                ? 'Stop requested · awaiting hangup'
                                : 'Stop this call'}
                        </button>
                    )}
                </>
            ) : (
                <div className="welcome">
                    <div className="welcome-art">
                        <span className="ring one" />
                        <span className="ring two" />
                        <span className="welcome-phone">
                            <Phone size={37} />
                            <span>
                                <Check size={17} />
                            </span>
                        </span>
                        <span className="floating-message">
                            I’ll take it from here.
                        </span>
                    </div>
                    <div className="eyebrow">YOUR NEW PLUS-ONE</div>
                    <h2>
                        Life’s too short
                        <br />
                        for hold music.
                    </h2>
                    <p>
                        Cancel an appointment. Chase a refund.
                        <br />
                        Sort out a reservation. Just tell Handle.
                    </p>
                    <div className="example-chips">
                        <span>Reservations</span>
                        <span>Refunds</span>
                        <span>Appointments</span>
                    </div>
                </div>
            )}
        </section>
    );
}
