import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
    ArrowUpRight,
    Check,
    ChevronRight,
    Inbox,
    Link2,
    Phone,
    Plus,
    ShieldCheck,
    Sparkles,
    X,
} from 'lucide-react';
import { request, statusLabels, type State } from './types.js';
import './style.css';
import { CaseDetail } from './CaseDetail.js';
import { Chat } from './Chat.js';
import { Connections } from './Connections.js';

function App() {
    const [state, setState] = useState<State>();
    const [selected, setSelected] = useState<string>();
    const [locked, setLocked] = useState(false);
    const [key, setKey] = useState('');
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [connected, setConnected] = useState(false);
    const [view, setView] = useState('cases');

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

        await request('/messages', { text, caseId: c?.id });
        setDraft('');
    }

    async function gmail() {
        const data = await request<{ url: string }>('/gmail/connect', {});

        window.location.assign(data.url);
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
    const done = state.cases.filter(
        (c) => c.status === 'resolved' && !c.mode,
    ).length;
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
                        onClick={() =>
                            void action(async () => {
                                const result = await request<{ id: string }>(
                                    '/cases/new',
                                    {},
                                );

                                setSelected(result.id);
                                setView('cases');
                                setDraft('');
                                setState(await request<State>('/state'));
                            })
                        }
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
                    <Connections
                        state={state}
                        busy={busy}
                        action={action}
                        gmail={gmail}
                        setState={setState}
                    />
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
                            <CaseDetail
                                c={c}
                                state={state}
                                busy={busy}
                                action={action}
                                send={send}
                                setSelected={setSelected}
                                setError={setError}
                            />
                            <Chat
                                messages={messages}
                                busy={busy}
                                draft={draft}
                                setDraft={setDraft}
                                action={action}
                                send={send}
                                gmail={gmail}
                            />
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
