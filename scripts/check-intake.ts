import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';
import { planIntake } from '../src/core/intake.js';
import type { Case } from '../src/core/model.js';
import { ElevenLabs } from '../src/providers/elevenlabs.js';

// Opt-in check against the hosted planner. Uses fictional inputs and never dials.
const voice = new ElevenLabs(loadConfig());
const blank: Case = {
    id: 'intake-check',
    owner: '+12025550142',
    spaceId: 'test',
    title: '',
    goal: '',
    business: '',
    phone: '',
    customerName: '',
    context: '',
    authorization: '',
    status: 'gathering',
    createdAt: 1,
    updatedAt: 1,
};
const scenarios = [
    {
        name: 'Public information without customer details',
        text: 'Call 202-555-0110 and ask what time their store closes today. Just ask, do not buy anything.',
        ready: true,
        goal: /clos|hours/i,
        needsEmail: false,
    },
    {
        name: 'Delivery inquiry without cancellation',
        text: 'Call 202-555-0110 for Northstar Store. Ask when my order H42 will arrive. My name is Alex. Only ask for the status; do not change or cancel it.',
        ready: true,
        goal: /arriv|deliver|status|ship/i,
        needsEmail: false,
    },
    {
        name: 'Rescheduling within stated preferences',
        text: 'Call 202-555-0110 and move my haircut from Monday at 2pm to Tuesday after 3pm. It is booked under Alex at Maple Salon. No fees; if Tuesday is unavailable keep Monday.',
        ready: true,
        goal: /resched|move|chang/i,
    },
    {
        name: 'Troubleshooting without account changes',
        text: 'Call 202-555-0110, the public setup helpdesk, and ask how to connect my model R2 router to a new modem. I only want general setup instructions, no account changes or paid support.',
        ready: true,
        goal: /connect|setup|router|troubleshoot/i,
        needsEmail: false,
    },
    {
        name: 'Unspecified intent stays open',
        text: 'I need some help.',
        ready: false,
        forbidden: /appointment|cancel|refund|reserv|booking/i,
    },
    {
        name: 'A correction replaces the earlier cancellation goal',
        text: 'Actually, do not cancel anything. Call the same number just to ask what time they close today.',
        existing: {
            goal: 'Cancel my appointment',
            phone: '+12025550110',
            business: 'Maple Salon',
            customerName: 'Alex',
            context: 'Monday 2pm',
            authorization: 'Cancel without fees',
        },
        ready: true,
        goal: /clos|hours/i,
        needsEmail: false,
    },
];

for (const scenario of scenarios) {
    try {
        const c = { ...blank, ...scenario.existing };
        const plan = await planIntake((p) => voice.text(p), c, [
            {
                id: scenario.name,
                caseId: c.id,
                actor: 'user',
                kind: 'message',
                text: scenario.text,
                at: 1,
            },
        ]);

        assert.equal(
            plan.ready,
            scenario.ready,
            `Unexpected readiness: ${plan.reply}`,
        );

        if (scenario.goal) {
            assert.match(plan.goal, scenario.goal);
        }

        if (scenario.forbidden) {
            assert.doesNotMatch(
                `${plan.goal} ${plan.reply}`,
                scenario.forbidden,
            );
        }

        if (scenario.needsEmail !== undefined) {
            assert.equal(plan.needsEmail, scenario.needsEmail);
        }

        if (scenario.ready) {
            assert.equal(plan.phone, '+12025550110');
        }

        if (scenario.name.startsWith('Public information')) {
            assert.equal(plan.customerName, '');
        }

        console.log(`PASS ${scenario.name}`);
    } catch (error) {
        console.error(`FAIL ${scenario.name}: ${(error as Error).message}`);
        process.exitCode = 1;
    }
}
