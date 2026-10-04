import { useEffect, useState } from 'react';
import { request } from './types.js';
import type { ConnectionCheck } from '../src/core/readiness.js';
import './readiness.css';

interface ReadinessState {
    checkedAt: number;
    canEnableCalling: boolean;
    callingEnabled: boolean;
    checks: ConnectionCheck[];
}

export function Readiness() {
    const [state, setState] = useState<ReadinessState>();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function refresh() {
        setBusy(true);
        setError('');

        try {
            setState(await request<ReadinessState>('/readiness'));
        } catch (error) {
            setError((error as Error).message);
        } finally {
            setBusy(false);
        }
    }

    useEffect(() => {
        void refresh();
    }, []);

    async function setCalling(enabled: boolean) {
        setBusy(true);

        try {
            await request('/settings/calling', { enabled });
            await refresh();
        } catch (error) {
            setError((error as Error).message);
            setBusy(false);
        }
    }

    return (
        <div className="connection-card readiness">
            <div className="readiness-heading">
                <div>
                    <h2>Ready for the first text?</h2>
                    <p>Check the connections before you start a live test.</p>
                </div>
                <button
                    className="primary"
                    onClick={() => void refresh()}
                    disabled={busy}
                >
                    {busy ? 'Checking…' : 'Check connections'}
                </button>
            </div>
            {state?.checks.map((check) => (
                <div
                    className="readiness-row"
                    key={check.name}
                >
                    <span className={`readiness-dot ${check.status}`} />
                    <div>
                        <strong>{check.name}</strong>
                        <p>{check.detail}</p>
                    </div>
                    <small>
                        {check.status === 'ready'
                            ? 'Connected'
                            : check.status === 'action'
                              ? 'Next step'
                              : 'Unavailable'}
                    </small>
                </div>
            ))}
            <div className="calling-control">
                <p>
                    {state?.callingEnabled
                        ? 'Real calls are enabled for ready requests.'
                        : 'Real calls are paused. Browser rehearsals remain available.'}
                </p>
                <button
                    disabled={
                        busy ||
                        !state ||
                        (!state.callingEnabled && !state.canEnableCalling)
                    }
                    onClick={() => void setCalling(!state?.callingEnabled)}
                >
                    {state?.callingEnabled
                        ? 'Pause real calls'
                        : 'Enable real calls'}
                </button>
            </div>
            {error && <p role="alert">{error}</p>}
        </div>
    );
}
