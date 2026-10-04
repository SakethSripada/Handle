import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { loadConfig } from '../src/config.js';
import { verifyOutcome } from '../src/core/outcome-verification.js';
import type { Case } from '../src/core/model.js';
import { ElevenLabs } from '../src/providers/elevenlabs.js';
import { TextAgents } from '../src/providers/text-agents.js';

const config = loadConfig();
const text = new TextAgents(config, new ElevenLabs(config));
const base: Case = {
    id: 'outcome-check',
    owner: '+12025550142',
    spaceId: 'test',
    title: 'Outcome check',
    goal: '',
    business: 'Example Store',
    phone: '+12025550110',
    customerName: '',
    context: '',
    authorization: '',
    status: 'verifying',
    createdAt: 1,
    updatedAt: 1,
};
const scenarios = [
    {
        name: 'Short factual answer',
        goal: 'Ask when the store closes',
        authority: 'Ask only',
        question: 'What time do you close?',
        answer: '6pm.',
        resolved: true,
    },
    {
        name: 'A promise is not completion',
        goal: 'Cancel appointment',
        authority: 'Cancel without a fee',
        question: 'Please cancel my appointment.',
        answer: 'I can cancel it for you.',
        resolved: false,
    },
    {
        name: 'Confirmed action',
        goal: 'Cancel appointment',
        authority: 'Cancel without a fee',
        question: 'Has the cancellation been completed?',
        answer: 'Yes, I have cancelled it with no fee. Confirmation C123.',
        resolved: true,
    },
    {
        name: 'An unauthorized fee prevents success',
        goal: 'Cancel appointment',
        authority: 'No fees authorized',
        question: 'Was it cancelled without a fee?',
        answer: 'I cancelled it and charged you a $50 fee.',
        resolved: false,
    },
];

console.log(`Checking outcomes through ${text.provider}.`);

for (const [index, scenario] of scenarios.entries()) {
    // Space opt-in checks to leave room for free-tier inference limits.
    if (text.provider === 'gemini' && index > 0) {
        await delay(15000);
    }

    try {
        const result = await verifyOutcome(
            (p) => text.verify(p),
            {
                ...base,
                goal: scenario.goal,
                authorization: scenario.authority,
                proposedOutcome: {
                    summary: 'Agent claims success',
                    confirmation: scenario.answer,
                },
            },
            [
                { role: 'agent', message: scenario.question },
                { role: 'user', message: scenario.answer },
            ],
            [],
        );

        assert.equal(result.resolved, scenario.resolved, result.reason);
        console.log(`PASS ${scenario.name}`);
    } catch (error) {
        console.error(`FAIL ${scenario.name}: ${(error as Error).message}`);
        process.exitCode = 1;
    }
}
