import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
    ArrowUpRight,
    ArrowUp,
    Check,
    ChevronRight,
    Headphones,
    Inbox,
    Link2,
    Mail,
    MessageCircle,
    Phone,
    Plus,
    Radio,
    ShieldCheck,
    Sparkles,
    X,
} from 'lucide-react';
import { request, statusLabels, type State, type Case } from './types.js';
import './style.css';
import { Rehearsal } from './Rehearsal.js';

function App() {
    const [state, setState] = useState<State>();
    const [selected, setSelected] = useState<string>();
    const [tab, setTab] = useState('activity');
    const [locked, setLocked] = useState(false);
    const [key, setKey] = useState('');
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [connected, setConnected] = useState(false);
    const [view, setView] = useState('cases');
    const [search, setSearch] = useState('');
    const [emails, setEmails] = useState<
        { subject: string; from: string; body: string; url: string }[]
    >([]);

    useEffect(() => {
        let source: EventSource;

        request<State>('/state')
            .then((data) => {
                setState(data);
                setLocked(false);
                source = new EventSource('/api/events');
                source.onmessage = (e) => {
                    setState(JSON.parse(e.data));
                    setConnected(true);
                };

                source.onerror = () => setConnected(false);
            })
            .catch(() => setLocked(true));

        return () => source?.close();
    }, [locked]);

    const c = state?.cases.find((c) => c.id === selected) ?? state?.cases[0];

    async function action(fn: () => Promise<unknown>) {
        setError('');
        setBusy(true);

        try {
            await fn();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    }

    async function send(text = draft) {
        if (!text.trim()) {
            return;
        }

        await request('/messages', { text });
        setDraft('');
    }

    async function gmail() {
        const data = await request<{ url: string }>('/gmail/connect', {});

        window.open(data.url, '_blank', 'noopener');
    }

    if (locked) {
        return (
            <div className="login">
                <div className="brand">
                    <span className="mark">h</span>handle
                    <span className="brand-dot">.</span>
                </div>
                <h1>
                    Your time.
                    <br />
                    Back in your hands.
                </h1>
                <p>Open your personal command center.</p>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        void action(async () => {
                            await request('/login', { token: key });
                            setLocked(false);
                        });
                    }}
                >
                    <label htmlFor="access">Workspace access key</label>
                    <input
                        id="access"
                        type="password"
                        autoComplete="current-password"
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                        placeholder="Enter your access key"
                    />
                    <button className="primary">
                        Open Handle <ArrowUpRight size={18} />
                    </button>
                </form>
                {error && <p role="alert">{error}</p>}
                <small>Your key is in this workspace’s local .env file.</small>
            </div>
        );
    }

    if (!state) {
        return <div className="loading">Opening Handle…</div>;
    }

    const active = state.cases.filter((c) =>
        ['dialing', 'in_call', 'waiting_approval'].includes(c.status),
    ).length;
    const done = state.cases.filter((c) => c.status === 'resolved').length;
    const timeline = state.events.filter(
        (e) =>
            e.caseId === c?.id &&
            (tab === 'transcript'
                ? e.kind === 'transcript'
                : e.kind !== 'transcript' && e.kind !== 'message'),
    );
    const messages = state.events.filter(
        (e) => e.caseId === c?.id && e.kind === 'message',
    );

    return (
        <div className="app">
            <aside className="sidebar">
                <div className="brand">
                    <span className="mark">h</span>handle
                    <span className="brand-dot">.</span>
                </div>
                <div className="workspace-label">YOUR PERSONAL ADVOCATE</div>
                <nav>
                    <button
                        className={view === 'cases' ? 'nav active' : 'nav'}
                        onClick={() => setView('cases')}
                    >
                        <Inbox size={18} /> Your requests{' '}
                        <span>{state.cases.length}</span>
                    </button>
                    <button
                        className={
                            view === 'connections' ? 'nav active' : 'nav'
                        }
                        onClick={() => setView('connections')}
                    >
                        <Link2 size={18} /> Connections
                    </button>
                </nav>
                <div className="sidebar-note">
                    <div className="orbit">
                        <Phone size={20} />
                    </div>
                    <h3>
                        Less hold.
                        <br />
                        More life.
                    </h3>
                    <p>
                        Tell us what needs doing.
                        <br />
                        We’ll take it from here.
                    </p>
                </div>
                <div className="sidebar-bottom">
                    <span className={connected ? 'dot live' : 'dot'} />{' '}
                    {connected ? 'Workspace live' : 'Reconnecting'}
                    <span className="avatar">S</span>
                </div>
            </aside>
            <main>
                <header>
                    <span>
                        PERSONAL WORKSPACE <ChevronRight size={13} />{' '}
                        {view === 'cases' ? 'REQUESTS' : 'CONNECTIONS'}
                    </span>
                    <div className="privacy">
                        <ShieldCheck size={15} /> Private by default
                    </div>
                </header>
                <section className="page-heading">
                    <div>
                        <div className="eyebrow">
                            A LITTLE LESS ON YOUR PLATE
                        </div>
                        <h1>
                            {view === 'cases'
                                ? 'Consider it handled.'
                                : 'Everything, connected.'}
                        </h1>
                        <p>
                            {view === 'cases'
                                ? 'The calls you don’t want to make. The time you get to keep.'
                                : 'Just enough context to get the job done.'}
                        </p>
                    </div>
                    <button
                        className="new-request"
                        onClick={() => {
                            setView('cases');
                            document
                                .querySelector<HTMLTextAreaElement>('textarea')
                                ?.focus();
                        }}
                    >
                        <Plus size={17} /> New request
                    </button>
                </section>
                {error && (
                    <div
                        className="error"
                        role="alert"
                    >
                        {error}
                        <button
                            aria-label="Dismiss error"
                            onClick={() => setError('')}
                        >
                            <X size={15} />
                        </button>
                    </div>
                )}
                {view === 'connections' ? (
                    <section className="connections">
                        <div className="connection-card">
                            <Mail size={30} />
                            <h2>Gmail</h2>
                            <p>
                                Find the reservation. Pull up the receipt. Check
                                the confirmation.
                            </p>
                            <span className="tag">
                                {state.services.gmail.replaceAll('_', ' ')}
                            </span>
                            <button
                                className="primary"
                                disabled={
                                    busy ||
                                    state.services.gmail === 'not_configured'
                                }
                                onClick={() =>
                                    void action(
                                        state.services.gmail === 'connected'
                                            ? async () => {
                                                  await request(
                                                      '/gmail/disconnect',
                                                      {},
                                                  );
                                                  setState(
                                                      await request<State>(
                                                          '/state',
                                                      ),
                                                  );
                                              }
                                            : gmail,
                                    )
                                }
                            >
                                {state.services.gmail === 'connected'
                                    ? 'Disconnect Gmail'
                                    : 'Connect Gmail'}
                                <ArrowUpRight size={17} />
                            </button>
                            <small>
                                Read-only access. You’re always in control.
                            </small>
                        </div>
                        <div className="connection-card">
                            <Radio size={30} />
                            <h2>The service desk</h2>
                            <p>A clear view of what’s connected and ready.</p>
                            {[
                                ['iMessage', state.services.photon],
                                ['Voice agent', state.services.voice],
                                ['Text planner', state.services.intake],
                                ['SpacetimeDB', state.services.spacetime],
                                [
                                    'Phone calling',
                                    state.services.calling
                                        ? 'enabled'
                                        : 'paused',
                                ],
                            ].map(([name, status]) => (
                                <div
                                    className="service"
                                    key={name}
                                >
                                    <span>{name}</span>
                                    <span className="tag">
                                        {status.replaceAll('_', ' ')}
                                    </span>
                                </div>
                            ))}
                        </div>
                        {state.services.gmail === 'connected' && (
                            <div className="mail-search">
                                <h2>Find a confirmation</h2>
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        void action(async () =>
                                            setEmails(
                                                (
                                                    await request<{
                                                        emails: typeof emails;
                                                    }>('/gmail/search', {
                                                        query: search,
                                                    })
                                                ).emails,
                                            ),
                                        );
                                    }}
                                >
                                    <input
                                        aria-label="Search Gmail"
                                        placeholder="Business, reservation, or order number"
                                        value={search}
                                        onChange={(e) =>
                                            setSearch(e.target.value)
                                        }
                                    />
                                    <button
                                        className="primary"
                                        disabled={busy}
                                    >
                                        Search
                                    </button>
                                </form>
                                {emails.map((email, i) => (
                                    <article key={i}>
                                        <a
                                            href={email.url}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            {email.subject}
                                            <ArrowUpRight size={14} />
                                        </a>
                                        <small>{email.from}</small>
                                        <p>{email.body.slice(0, 600)}</p>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>
                ) : (
                    <>
                        <section className="stats">
                            <div>
                                <span className="stat-icon">
                                    <Inbox size={20} />
                                </span>
                                <span>
                                    <strong>
                                        {String(state.cases.length).padStart(
                                            2,
                                            '0',
                                        )}
                                    </strong>
                                    <small>Total requests</small>
                                </span>
                            </div>
                            <div>
                                <span className="stat-icon">
                                    <Phone size={20} />
                                </span>
                                <span>
                                    <strong>
                                        {String(active).padStart(2, '0')}
                                    </strong>
                                    <small>On the line</small>
                                </span>
                            </div>
                            <div>
                                <span className="stat-icon">
                                    <Check size={20} />
                                </span>
                                <span>
                                    <strong>
                                        {String(done).padStart(2, '0')}
                                    </strong>
                                    <small>Handled for you</small>
                                </span>
                            </div>
                            <p>
                                <span className="tiny-star">✳</span> You have
                                better things to do.
                            </p>
                        </section>
                        <div className="work-grid">
                            <section className="requests-panel">
                                <div className="section-title">
                                    <h2>Your requests</h2>
                                    <span>{state.cases.length} total</span>
                                </div>
                                {state.cases.length === 0 ? (
                                    <div className="empty-list">
                                        <Inbox size={24} />
                                        <p>A clean slate.</p>
                                        <small>
                                            Your requests will appear here.
                                        </small>
                                    </div>
                                ) : (
                                    state.cases.map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => {
                                                setSelected(item.id);
                                                setTab('activity');
                                            }}
                                            className={`request-row ${item.id === c?.id ? 'selected' : ''}`}
                                        >
                                            <span
                                                className={`request-icon ${item.status === 'resolved' ? 'done' : ''}`}
                                            >
                                                {item.status === 'resolved' ? (
                                                    <Check size={17} />
                                                ) : (
                                                    <Phone size={17} />
                                                )}
                                            </span>
                                            <span>
                                                <strong>{item.title}</strong>
                                                <small>
                                                    {item.business ||
                                                        'Getting started'}
                                                </small>
                                                <em
                                                    className={`status ${item.status}`}
                                                >
                                                    {statusLabels[item.status]}
                                                </em>
                                            </span>
                                            <ChevronRight size={15} />
                                        </button>
                                    ))
                                )}
                                <div className="quiet-note">
                                    <ShieldCheck size={16} />
                                    <p>
                                        We ask when it matters.
                                        <br />
                                        We handle the rest.
                                    </p>
                                </div>
                            </section>
                            <section className="detail-panel">
                                {c ? (
                                    <>
                                        <div className="detail-top">
                                            <span
                                                className={`status ${c.status}`}
                                            >
                                                <span className="dot" />
                                                {statusLabels[c.status]}
                                            </span>
                                            <span className="case-ref">
                                                #
                                                {c.id.slice(0, 6).toUpperCase()}
                                            </span>
                                        </div>
                                        <h2>{c.title}</h2>
                                        <p className="goal">
                                            {c.goal ||
                                                'Tell Handle what you need help with.'}
                                        </p>
                                        <div className="case-facts">
                                            <div>
                                                <small>BUSINESS</small>
                                                <span>
                                                    {c.business ||
                                                        'Not provided yet'}
                                                </span>
                                            </div>
                                            <div>
                                                <small>CALLING FOR</small>
                                                <span>
                                                    {c.customerName ||
                                                        'Not provided yet'}
                                                </span>
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
                                                    disabled={
                                                        !state.services
                                                            .calling || busy
                                                    }
                                                    onClick={() =>
                                                        void action(() =>
                                                            request(
                                                                `/cases/${c.id}/start`,
                                                                {},
                                                            ),
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
                                                    <small>
                                                        ONE DECISION FOR YOU
                                                    </small>
                                                    <p>{a.question}</p>
                                                    <div>
                                                        <button
                                                            onClick={() =>
                                                                void action(
                                                                    () =>
                                                                        send(
                                                                            `YES ${a.id}`,
                                                                        ),
                                                                )
                                                            }
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            onClick={() =>
                                                                void action(
                                                                    () =>
                                                                        send(
                                                                            `NO ${a.id}`,
                                                                        ),
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
                                                className={
                                                    tab === 'activity'
                                                        ? 'selected'
                                                        : ''
                                                }
                                                onClick={() =>
                                                    setTab('activity')
                                                }
                                            >
                                                Activity
                                            </button>
                                            <button
                                                className={
                                                    tab === 'transcript'
                                                        ? 'selected'
                                                        : ''
                                                }
                                                onClick={() =>
                                                    setTab('transcript')
                                                }
                                            >
                                                Call transcript
                                            </button>
                                            <button
                                                className={
                                                    tab === 'context'
                                                        ? 'selected'
                                                        : ''
                                                }
                                                onClick={() =>
                                                    setTab('context')
                                                }
                                            >
                                                Context
                                            </button>
                                        </div>
                                        {tab === 'context' ? (
                                            <div className="context">
                                                <h4>What we know</h4>
                                                <p>
                                                    {c.context ||
                                                        'Still gathering the details.'}
                                                </p>
                                                <h4>What you’ve authorized</h4>
                                                <p>
                                                    {c.authorization ||
                                                        'No action authorized yet.'}
                                                </p>
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
                                                                    {e.actor ===
                                                                    'business'
                                                                        ? 'Business'
                                                                        : e.actor ===
                                                                            'handle'
                                                                          ? 'Handle'
                                                                          : 'System'}{' '}
                                                                    <time>
                                                                        {new Date(
                                                                            e.at,
                                                                        ).toLocaleTimeString(
                                                                            [],
                                                                            {
                                                                                hour: '2-digit',
                                                                                minute: '2-digit',
                                                                            },
                                                                        )}
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
                                                            {tab ===
                                                            'transcript'
                                                                ? 'The conversation will appear here.'
                                                                : 'We’re getting your request ready.'}
                                                        </p>
                                                        <small>
                                                            {tab ===
                                                            'transcript'
                                                                ? 'The full transcript is available after the call.'
                                                                : 'Meaningful updates appear as the case moves forward.'}
                                                        </small>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {[
                                            'dialing',
                                            'in_call',
                                            'waiting_approval',
                                        ].includes(c.status) && (
                                            <button
                                                className="stop"
                                                onClick={() =>
                                                    void action(() =>
                                                        request(
                                                            `/cases/${c.id}/stop`,
                                                            {},
                                                        ),
                                                    )
                                                }
                                            >
                                                Stop this call
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
                                        <div className="eyebrow">
                                            YOUR NEW PLUS-ONE
                                        </div>
                                        <h2>
                                            Life’s too short
                                            <br />
                                            for hold music.
                                        </h2>
                                        <p>
                                            Cancel an appointment. Chase a
                                            refund.
                                            <br />
                                            Sort out a reservation. Just tell
                                            Handle.
                                        </p>
                                        <div className="example-chips">
                                            <span>Reservations</span>
                                            <span>Refunds</span>
                                            <span>Appointments</span>
                                        </div>
                                    </div>
                                )}
                            </section>
                            <section className="chat-panel">
                                <div className="chat-heading">
                                    <span className="chat-avatar">h</span>
                                    <div>
                                        <strong>Handle</strong>
                                        <small>Your personal assistant</small>
                                    </div>
                                    <MessageCircle size={19} />
                                </div>
                                <div className="chat-body">
                                    <div className="chat-date">
                                        {new Date().toLocaleDateString([], {
                                            month: 'long',
                                            day: 'numeric',
                                        })}
                                    </div>
                                    <div className="bubble assistant">
                                        Hey. What can I take off your plate?
                                    </div>
                                    {messages.map((e) => (
                                        <div
                                            key={e.id}
                                            className={`bubble ${e.actor === 'user' ? 'user' : 'assistant'}`}
                                        >
                                            {e.text}
                                        </div>
                                    ))}
                                    {busy && <div className="typing">•••</div>}
                                </div>
                                <form
                                    className="composer"
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        void action(() => send());
                                    }}
                                >
                                    <textarea
                                        aria-label="Message Handle"
                                        placeholder="Tell Handle what you need…"
                                        value={draft}
                                        rows={2}
                                        onChange={(e) =>
                                            setDraft(e.target.value)
                                        }
                                        onKeyDown={(e) => {
                                            if (
                                                e.key === 'Enter' &&
                                                !e.shiftKey
                                            ) {
                                                e.preventDefault();
                                                void action(() => send());
                                            }
                                        }}
                                    />
                                    <div>
                                        <button
                                            type="button"
                                            title="Connect Gmail"
                                            aria-label="Connect Gmail"
                                            onClick={() => void action(gmail)}
                                        >
                                            <Mail size={18} />
                                        </button>
                                        <span>Just ask. We’ll handle it.</span>
                                        <button
                                            className="send"
                                            aria-label="Send message"
                                            disabled={busy || !draft.trim()}
                                        >
                                            <ArrowUp size={18} />
                                        </button>
                                    </div>
                                </form>
                                <small className="chat-footnote">
                                    Workspace chat · Same agent as iMessage
                                </small>
                            </section>
                        </div>
                    </>
                )}
                <footer>
                    <span>HANDLE THE BORING. LIVE THE REST.</span>
                    <span>
                        Made for the moments in between. <Sparkles size={12} />
                    </span>
                </footer>
            </main>
        </div>
    );
}

createRoot(document.getElementById('root')!).render(<App />);
