import { loadConfig } from '../src/config.js';

const config = loadConfig();

async function main() {
    const response = await fetch(
        `http://127.0.0.1:${config.PORT}/api/gmail/status`,
        {
            headers: { Authorization: `Bearer ${config.DASHBOARD_TOKEN}` },
            signal: AbortSignal.timeout(30000),
        },
    );

    if (!response.ok) {
        throw new Error(
            'Gmail access could not be verified. Open Connections in Handle, connect Gmail, and complete Google consent.',
        );
    }

    const status = await response.json();

    if (status.connected !== true || typeof status.email !== 'string') {
        throw new Error('Gmail returned an unexpected connection status.');
    }

    console.log('PASS authenticated Gmail profile request');
    console.log('No email contents or credentials were printed.');
}

void main().catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
});
