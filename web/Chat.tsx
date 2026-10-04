import { useEffect, useRef } from 'react';
import { MessageCircle, Mail, ArrowUp } from 'lucide-react';
import type { CaseEvent } from './types.js';

interface Props {
    messages: CaseEvent[];
    busy: boolean;
    draft: string;
    setDraft: (text: string) => void;
    action: (fn: () => Promise<unknown>) => Promise<void>;
    send: () => Promise<void>;
    gmail: () => Promise<void>;
}

export function Chat({
    messages,
    busy,
    draft,
    setDraft,
    action,
    send,
    gmail,
}: Props) {
    const end = useRef<HTMLDivElement>(null);

    useEffect(() => {
        end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, [messages.length]);

    return (
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
                {(busy || messages.at(-1)?.actor === 'user') && (
                    <div className="typing">•••</div>
                )}
                <div ref={end} />
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
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
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
    );
}
