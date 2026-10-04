import { useEffect, useState } from 'react';
import type { CallMemory as Memory } from '../src/core/memory.js';
import { request, type Case } from './types.js';

export function CallMemory({ c }: { c: Case }) {
    const [memories, setMemories] = useState<Memory[]>([]);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let active = true;

        setMemories([]);
        setError('');
        void request<{ memories: Memory[] }>(`/cases/${c.id}/memory`)
            .then((result) => {
                if (active) {
                    setMemories(result.memories);
                }
            })
            .catch(() => {
                if (active) {
                    setError('Past call history is temporarily unavailable.');
                }
            });

        return () => {
            active = false;
        };
    }, [c.id, c.updatedAt]);

    async function toggle() {
        setBusy(true);
        setError('');

        try {
            await request(`/cases/${c.id}/memory`, {
                excluded: !c.memoryExcluded,
            });
        } catch (error) {
            setError((error as Error).message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="call-memory">
            <h4>Past calls</h4>
            <p>
                Handle can refer to confirmed outcomes with this business from
                the last 90 days. Each new request needs its own authorization.
            </p>
            {memories.length ? (
                memories.map((memory) => (
                    <article key={memory.caseId}>
                        <small>
                            {new Date(memory.completedAt).toLocaleDateString()}{' '}
                            · #{memory.caseId.slice(0, 6).toUpperCase()}
                        </small>
                        <p>{memory.outcome}</p>
                    </article>
                ))
            ) : (
                <p>No relevant confirmed calls yet.</p>
            )}
            {c.confirmedAt && c.mode !== 'rehearsal' && (
                <div>
                    <p>
                        {c.memoryExcluded
                            ? 'This outcome is excluded from future recall.'
                            : 'This outcome is available for future requests to this business.'}
                    </p>
                    <button
                        disabled={busy}
                        onClick={() => void toggle()}
                    >
                        {c.memoryExcluded
                            ? 'Include in future recall'
                            : 'Exclude from future recall'}
                    </button>
                </div>
            )}
            {error && <p role="alert">{error}</p>}
        </section>
    );
}
