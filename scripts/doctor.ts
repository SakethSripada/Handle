import { loadConfig } from '../src/config.js';

const config = loadConfig();

const base = `http://127.0.0.1:${config.PORT}`;

const headers = { Authorization: `Bearer ${config.DASHBOARD_TOKEN}` };

const health = await fetch(`${base}/health`);

if (!health.ok) {
    throw new Error('Handle is not running.');
}

const state = await (await fetch(`${base}/api/state`, { headers })).json();

console.log('Handle is running. Connection status:');
console.log('Delivery queues:', JSON.stringify(state.queues ?? {}));

for (const name of [
    'photon',
    'voice',
    'intake',
    'calling',
    'spacetime',
    'gmail',
]) {
    console.log(`  ${name}: ${state.services[name]}`);
}

const checks = [
    [
        'Dashboard requires authentication',
        await fetch(`${base}/api/state`),
        401,
    ],
    [
        'Readiness requires authentication',
        await fetch(`${base}/api/readiness`),
        401,
    ],
    [
        'Credential changes require authentication',
        await fetch(`${base}/api/settings/credentials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
        }),
        401,
    ],
    [
        'Voice tools reject missing credentials',
        await fetch(`${base}/tools/unknown/get_case_context`, {
            method: 'POST',
        }),
        401,
    ],
    [
        'Webhooks reject unsigned payloads',
        await fetch(`${base}/webhooks/elevenlabs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
        }),
        401,
    ],
    [
        'Cross-origin writes are rejected',
        await fetch(`${base}/api/messages`, {
            method: 'POST',
            headers: {
                ...headers,
                Origin: 'https://untrusted.example',
                'Content-Type': 'application/json',
            },
            body: '{"text":"ignored"}',
        }),
        403,
    ],
] as const;

for (const [name, response, expected] of checks) {
    console.log(`${response.status === expected ? 'PASS' : 'FAIL'} ${name}`);

    if (response.status !== expected) {
        process.exitCode = 1;
    }
}

if (!state.services.calling) {
    console.log('Real calls are paused. Browser rehearsal is available.');
}

const auditResponse = await fetch(`${base}/api/storage-audit`, { headers });

if (auditResponse.ok) {
    const audit = await auditResponse.json();

    console.log(
        `${audit.consistent ? 'PASS' : 'FAIL'} SpacetimeDB record parity`,
        JSON.stringify(audit.counts),
    );

    if (!audit.consistent) {
        process.exitCode = 1;
    }
} else {
    console.log(
        'FAIL SpacetimeDB record audit unavailable. Local data remains available.',
    );
    process.exitCode = 1;
}
