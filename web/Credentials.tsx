import { useState } from 'react';
import { request } from './types.js';
import './credentials.css';

const fields = [
    ['PHOTON_PROJECT_SECRET', 'Photon project secret'],
    ['TWILIO_ACCOUNT_SID', 'Twilio account SID'],
    ['TWILIO_AUTH_TOKEN', 'Twilio auth token'],
] as const;

export function Credentials() {
    const [values, setValues] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');

    if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) {
        return null;
    }

    return (
        <details className="connection-card credentials">
            <summary>Service credentials</summary>
            <p>
                Connect the existing accounts for this installation. Saved keys
                are never displayed.
            </p>
            <form
                onSubmit={async (event) => {
                    event.preventDefault();
                    setBusy(true);
                    setMessage('');

                    try {
                        const supplied = Object.fromEntries(
                            Object.entries(values).filter(([, value]) =>
                                value.trim(),
                            ),
                        );

                        await request('/settings/credentials', supplied);
                        setValues({});
                        setMessage(
                            'Saved locally. Handle will use these credentials.',
                        );
                    } catch (error) {
                        setMessage((error as Error).message);
                    } finally {
                        setBusy(false);
                    }
                }}
            >
                {fields.map(([key, label]) => (
                    <label key={key}>
                        {label}
                        <input
                            type="password"
                            autoComplete="off"
                            value={values[key] ?? ''}
                            onChange={(event) =>
                                setValues({
                                    ...values,
                                    [key]: event.target.value,
                                })
                            }
                        />
                    </label>
                ))}
                <button
                    className="primary"
                    disabled={busy || !Object.values(values).some(Boolean)}
                >
                    {busy ? 'Saving…' : 'Save credentials'}
                </button>
                <small role="status">{message}</small>
            </form>
        </details>
    );
}
