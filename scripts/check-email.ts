import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';
import { TextAgents } from '../src/providers/text-agents.js';
import { ElevenLabs } from '../src/providers/elevenlabs.js';
import { planIntake } from '../src/core/intake.js';

const cfg = loadConfig();
const text = new TextAgents(cfg, new ElevenLabs(cfg));
const c: any = {
    id: 'isolated-check',
    owner: '+12025550142',
    spaceId: 'web:test',
    title: '',
    goal: '',
    phone: '',
    business: '',
    customerName: '',
    context: '',
    authorization: '',
    status: 'gathering',
    createdAt: 1,
    updatedAt: 1,
};
const events: any = [
    {
        id: 'q',
        caseId: c.id,
        kind: 'message',
        actor: 'user',
        at: 1,
        text: 'Find my latest receipt from Maple Salon and tell me the amount. Do not call anyone yet.',
    },
];
const p = await planIntake((x) => text.intake(x), c, events);

assert.equal(p.ready, false);
assert.equal(p.emailOnly, true);
assert.equal(p.needsEmail, true);
assert.match(p.emailQuery, /Maple/i);
console.log(
    'PASS live Gemini requests standalone email lookup without dialing',
);

const evidence = [
    {
        id: 'fictional',
        subject: 'Maple Salon receipt',
        from: 'salon@example.test',
        date: '2026-10-04',
        body: 'Alex Demo paid $42.00 for a haircut. Reference TEST42.',
        url: 'https://mail.google.com/',
    },
];
const q = await planIntake(
    (x) => text.intake(x),
    { ...c, ...p },
    events,
    evidence,
    [],
    { status: 'found', query: p.emailQuery },
);

assert.equal(q.ready, false);
assert.equal(q.emailOnly, true);
assert.match(q.reply, /42/);
console.log(
    'PASS live Gemini answers from fictional email evidence without requiring a phone number',
);

const r = await planIntake((x) => text.intake(x), c, [
    {
        ...events[0],
        text: 'Call 202-555-0110 and ask what time the store closes today. Ask only, no changes.',
    },
]);

assert.equal(r.ready, true);
assert.equal(r.needsEmail, false);
assert.equal(r.phone, '+12025550110');
console.log(
    'PASS live Gemini still prepares ordinary customer-service requests',
);
