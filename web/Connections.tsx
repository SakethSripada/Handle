import { Readiness } from './Readiness.js';
import { Credentials } from './Credentials.js';
import { useState } from 'react';
import { Mail, Radio, ArrowUpRight } from 'lucide-react';
import { request, type State } from './types.js';

interface Props {
    state: State;
    busy: boolean;
    action: (fn: () => Promise<unknown>) => Promise<void>;
    gmail: () => Promise<void>;
    setState: (state: State) => void;
}

export function Connections({ state, busy, action, gmail, setState }: Props) {
    const [search, setSearch] = useState('');
    const [emails, setEmails] = useState<
        { subject: string; from: string; body: string; url: string }[]
    >([]);

    return (
        <section className="connections">
            <Readiness />
            <Credentials />
            <div className="connection-card">
                <Mail size={30} />
                <h2>Gmail</h2>
                <p>
                    Find the reservation. Pull up the receipt. Check the
                    confirmation.
                </p>
                <span className="tag">
                    {state.services.gmail.replaceAll('_', ' ')}
                </span>
                <button
                    className="primary"
                    disabled={busy || state.services.gmail === 'not_configured'}
                    onClick={() =>
                        void action(
                            state.services.gmail === 'connected'
                                ? async () => {
                                      await request('/gmail/disconnect', {});
                                      setState(await request<State>('/state'));
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
                <small>Read-only access. You’re always in control.</small>
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
                        state.services.calling ? 'enabled' : 'paused',
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
            <div className="connection-card">
                <h2>Delivery and storage</h2>
                <p>
                    SpacetimeDB stores cases, decisions, transcripts, and
                    pending texts. Live subscriptions keep this dashboard in
                    sync.
                </p>
                <div className="service">
                    <span>Texts awaiting delivery</span>
                    <span className="tag">
                        {state.queues?.messages.pending ?? 0}
                    </span>
                </div>
                <div className="service">
                    <span>Incoming texts to process</span>
                    <span className="tag">{state.queues?.incoming ?? 0}</span>
                </div>
                <small>
                    {state.services.lastSyncedAt
                        ? `Last database update: ${new Date(state.services.lastSyncedAt).toLocaleTimeString()}`
                        : 'Waiting for the initial database subscription.'}
                </small>
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
                            onChange={(e) => setSearch(e.target.value)}
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
    );
}
