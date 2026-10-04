import { randomUUID } from 'node:crypto';
import type { Config } from '../config.js';
import type { Case, Incoming, Messenger } from './model.js';
import { Store } from './store.js';
import { token } from './crypto.js';
import { recallCalls } from './memory.js';
import { planIntake } from './intake.js';
import { Decisions } from './decisions.js';
import { ElevenLabs } from '../providers/elevenlabs.js';
import { Gmail } from '../providers/gmail.js';
import twilio from 'twilio';
import { checkVoiceRoute, voiceNumberId } from '../providers/voice-routing.js';
import { Telephony } from '../providers/telephony.js';
import { demoCommand, demoDetails } from './demo.js';
import { TextAgents } from '../providers/text-agents.js';

export class Engine {
    readonly decisions: Decisions;
    readonly telephony: Telephony;
    readonly text: TextAgents;
    private queues = new Map<string, Promise<void>>();

    constructor(
        readonly config: Config,
        readonly store: Store,
        readonly voice: ElevenLabs,
        readonly gmail: Gmail,
    ) {
        this.telephony = new Telephony(config);
        this.text = new TextAgents(config, voice);
        this.decisions = new Decisions(store, (c, text) =>
            this.notify(c, text),
        );
    }

    notify(c: Case, text: string, id: string = randomUUID()) {
        this.store.event(c.id, 'message', 'handle', text, `out:${id}`);
        this.store.enqueue(
            'message',
            { spaceId: c.spaceId, line: c.line, text },
            id,
        );
    }

    accept(input: Incoming) {
        const allowed = this.config.ALLOWED_SENDERS.split(',')
            .map((s) => s.trim())
            .filter(Boolean);

        if (!allowed.includes(input.owner)) {
            throw new Error('This sender is not enrolled in Handle.');
        }

        if (input.text.length > 10000) {
            throw new Error('Message is too long.');
        }

        if (this.store.receive(input.id, input)) {
            this.schedule(input);
        }
    }

    resume() {
        for (const row of this.store.pendingInbox()) {
            this.schedule(JSON.parse(row.body));
        }
    }

    private schedule(input: Incoming) {
        const previous = this.queues.get(input.owner) ?? Promise.resolve();
        const next = previous
            .catch(() => {})
            .then(() => this.process(input))
            .catch((error) => {
                const c = this.store
                    .cases()
                    .find(
                        (c) =>
                            c.owner === input.owner &&
                            c.spaceId === input.spaceId,
                    );

                if (c) {
                    this.store.event(
                        c.id,
                        'error',
                        'system',
                        (error as Error).message,
                    );
                    this.notify(
                        c,
                        'I hit a connection problem and haven’t started a new call. Send that again in a moment.',
                    );
                }
            })
            .finally(() => {
                this.store.completeInbox(input.id);

                if (this.queues.get(input.owner) === next) {
                    this.queues.delete(input.owner);
                }
            });

        this.queues.set(input.owner, next);
    }

    async idle() {
        await Promise.all(this.queues.values());
    }

    private async process(input: Incoming) {
        const demo = demoCommand(input.text);
        let c = this.store
            .cases()
            .find(
                (c) =>
                    c.owner === input.owner &&
                    c.spaceId === input.spaceId &&
                    c.mode !== 'rehearsal' &&
                    [
                        'verifying',
                        'gathering',
                        'ready',
                        'dialing',
                        'in_call',
                        'waiting_approval',
                    ].includes(c.status),
            );

        if (input.caseId) {
            const selected = this.store.case(input.caseId);

            if (!selected || selected.owner !== input.owner) {
                throw new Error('Case does not belong to this sender.');
            }

            c = selected;

            if (
                [
                    'resolved',
                    'completed',
                    'failed',
                    'cancelled',
                    'follow_up',
                ].includes(c.status) &&
                !/^status|^connect|^(yes|no) /i.test(input.text) &&
                !demo
            ) {
                this.notify(
                    c,
                    'This request is closed. Start a new request for another action.',
                );

                return;
            }
        }

        const previousEvent = this.store.get<{ caseId: string }>(
            'event',
            `in:${input.id}`,
        );

        if (previousEvent) {
            c = this.store.case(previousEvent.caseId);

            if (demo && c?.mode === 'demo') {
                // A restart must not redial a demo whose command was already applied.
                return;
            }
        }

        const live =
            c &&
            ['dialing', 'in_call', 'waiting_approval', 'verifying'].includes(
                c.status,
            );

        if (
            !previousEvent &&
            !live &&
            (demo?.phone ||
                (c?.mode === 'demo' &&
                    !/^(status[?.!]?|stop|stop call|cancel request)$/i.test(
                        input.text.trim(),
                    )))
        ) {
            c = undefined;
        }

        if (!c) {
            c = this.store.saveCase({
                id: randomUUID(),
                owner: input.owner,
                spaceId: input.spaceId,
                line: input.line,
                title: 'New request',
                status: 'gathering',
                goal: '',
                business: '',
                phone: '',
                customerName: '',
                context: '',
                authorization: '',
                createdAt: Date.now(),
                updatedAt: Date.now(),
            });
        }

        this.store.event(c.id, 'message', 'user', input.text, `in:${input.id}`);

        if (demo) {
            if (!demo.phone) {
                this.notify(
                    c,
                    'Send Demo call followed by one phone number, including its country code. Ask the participant before calling.',
                );
            } else if (live) {
                this.notify(
                    c,
                    'There is already a call in progress. Finish or stop it before starting a demo.',
                );
            } else {
                Object.assign(c, demoDetails(demo.phone));
                this.store.saveCase(c);

                if (
                    this.config.CALLING_ENABLED === 'true' &&
                    voiceNumberId(this.config)
                ) {
                    this.notify(
                        c,
                        'Your demo is ready. I’ll call the participant now.',
                    );
                    await this.start(c.id);
                } else {
                    this.notify(
                        c,
                        'Your demo is ready. Phone calling is paused; start it from the dashboard after connecting a voice line.',
                    );
                }
            }

            return;
        }

        if (/^(yes|no)\s+[a-f0-9]{6}/i.test(input.text.trim())) {
            try {
                this.decisions.answer(input.owner, input.text);
            } catch (error) {
                this.notify(c, (error as Error).message);
            }

            return;
        }

        if (/^connect\s+(gmail|email)$/i.test(input.text.trim())) {
            this.notify(
                c,
                this.gmail.configured
                    ? `Connect Gmail so I can find relevant receipts and confirmations: ${this.gmail.connectionLink(input.owner)}`
                    : 'Gmail setup is not finished yet. You can paste the reservation or receipt details here.',
            );

            return;
        }

        if (/^status[?.!]?$/i.test(input.text.trim())) {
            this.notify(
                c,
                `${c.title}: ${c.status.replaceAll('_', ' ')}. ${c.outcome ?? ''}`.trim(),
            );

            return;
        }

        if (/^(stop|stop call|cancel request)$/i.test(input.text.trim())) {
            await this.stop(c.id);

            return;
        }

        if (c.status === 'verifying') {
            this.notify(
                c,
                'The call has ended. I’m checking the business’s confirmation before reporting the result.',
            );

            return;
        }

        if (['dialing', 'in_call', 'waiting_approval'].includes(c.status)) {
            c.context += `\nCustomer update: ${input.text}`;
            this.store.saveCase(c);
            this.notify(c, 'Got it. I’ve added that to the call context.');

            return;
        }

        let plan = await planIntake(
            (p) => this.text.intake(p),
            c,
            this.store.events(c.id),
            [],
            recallCalls(this.store, c),
        );

        if (
            plan.needsEmail &&
            plan.business &&
            this.gmail.connected(c.owner) &&
            !this.store.get('mail-searched', c.id)
        ) {
            this.store.put('mail-searched', c.id, true);

            try {
                const business = plan.business.replace(/["\\]/g, '');
                const emails = await this.gmail.search(
                    c.owner,
                    `"${business}" newer_than:1y`,
                );

                if (emails.length) {
                    for (const email of emails) {
                        this.store.event(
                            c.id,
                            'email',
                            'system',
                            `${email.subject}\nFrom: ${email.from}\n${email.date}`,
                            `email:${c.id}:${email.id}`,
                        );
                    }

                    plan = await planIntake(
                        (p) => this.text.intake(p),
                        { ...c, ...plan },
                        this.store.events(c.id),
                        emails,
                        recallCalls(this.store, { ...c, ...plan }),
                    );
                }
            } catch {
                this.store.remove('mail-searched', c.id);
                this.store.event(
                    c.id,
                    'status',
                    'system',
                    'Email lookup was unavailable. Continuing with the details you provided.',
                );
            }
        }

        Object.assign(c, {
            title: plan.title,
            goal: plan.goal,
            business: plan.business,
            phone: plan.phone,
            customerName: plan.customerName,
            context: plan.context,
            authorization: plan.authorization,
            status: plan.ready ? 'ready' : 'gathering',
        });
        this.store.saveCase(c);

        if (plan.ready) {
            if (
                this.config.CALLING_ENABLED === 'true' &&
                voiceNumberId(this.config)
            ) {
                this.notify(
                    c,
                    'I have what I need. I’ll call now and text you when there’s an outcome or a decision.',
                );
                await this.start(c.id);
            } else {
                this.notify(
                    c,
                    'I have everything I need. Your request is ready; phone calling is currently paused.',
                );
            }
        } else {
            this.notify(c, plan.reply);
        }
    }

    async start(id: string) {
        const c = this.store.case(id);

        if (!c || c.status !== 'ready') {
            throw new Error('Only a ready case can start a call.');
        }

        if (this.config.CALLING_ENABLED !== 'true') {
            throw new Error(
                'Real calls are paused. Enable calling after connecting a sender number.',
            );
        }

        const provider = this.config.VOICE_PROVIDER;

        this.checkOtherCalls(c);

        await checkVoiceRoute(this.config, this.voice, this.telephony, c.phone);

        if (
            this.config.CALLING_ENABLED !== 'true' ||
            this.config.VOICE_PROVIDER !== provider
        ) {
            throw new Error(
                'Real calls were paused while checking the phone connection.',
            );
        }

        const current = this.store.case(id);

        this.checkOtherCalls(c);

        if (
            !current ||
            current.status !== 'ready' ||
            current.updatedAt !== c.updatedAt
        ) {
            throw new Error(
                'The request changed while checking the phone connection. Review its current status.',
            );
        }

        c.voiceProvider = provider;
        c.status = 'dialing';
        c.callToken = token();
        this.store.saveCase(c);
        this.store.event(
            c.id,
            'status',
            'system',
            `Dialing ${c.business || c.phone}`,
        );

        try {
            const result = await this.voice.startCall(c);
            // Re-read: a fast tool callback may have already changed the status.
            const current = this.store.case(id)!;

            this.store.saveCase({
                ...current,
                conversationId: result.conversation_id,
                callSid: result.callSid,
                sipCallId: result.sip_call_id,
            });
        } catch (error) {
            this.store.saveCase({
                ...this.store.case(id)!,
                status: 'failed',
                outcome:
                    'Call initiation failed or was not confirmed. Check provider history before retrying.',
            });
            this.store.event(id, 'error', 'system', (error as Error).message);
            this.notify(
                c,
                'I couldn’t confirm that the call started. I won’t redial automatically; check the call status first.',
            );
        }
    }

    private checkOtherCalls(c: Case) {
        if (
            this.store
                .cases()
                .some(
                    (other) =>
                        other.id !== c.id &&
                        other.owner === c.owner &&
                        other.mode !== 'rehearsal' &&
                        ['dialing', 'in_call', 'waiting_approval'].includes(
                            other.status,
                        ),
                )
        ) {
            throw new Error(
                'Finish the current call before starting another one.',
            );
        }
    }

    async stop(id: string) {
        const c = this.store.case(id);

        if (!c) {
            throw new Error('Case not found.');
        }

        if (
            c.voiceProvider === 'photon' &&
            ['dialing', 'in_call', 'waiting_approval'].includes(c.status)
        ) {
            this.store.saveCase({ ...c, stopRequestedAt: Date.now() });
            this.store.event(
                c.id,
                'status',
                'system',
                'Stop requested. Authority revoked; waiting for the voice agent to end the SIP call.',
            );
            this.notify(
                c,
                'Stop requested. The agent will end the call when it next checks in. Hangup is not confirmed yet.',
            );

            return;
        }

        if (c.callSid) {
            if (!this.config.TWILIO_AUTH_TOKEN) {
                throw new Error(
                    'Cannot stop the live call without Twilio credentials.',
                );
            }

            await twilio(
                this.config.TWILIO_ACCOUNT_SID,
                this.config.TWILIO_AUTH_TOKEN,
            )
                .calls(c.callSid)
                .update({ status: 'completed' });
        } else if (c.status === 'dialing') {
            throw new Error(
                'The provider has not returned a call ID yet. Check the voice provider before stopping.',
            );
        }

        this.store.saveCase({
            ...c,
            status: 'cancelled',
            outcome: 'Stopped at the customer’s request.',
            callToken: undefined,
        });
        this.notify(c, 'Stopped. I won’t take further action on this request.');
    }

    async flushMessages(messenger: Messenger) {
        for (const job of this.store.jobs('message')) {
            try {
                const data = JSON.parse(job.body);

                await messenger.send(data.spaceId, data.text, data.line);
                this.store.finishJob(job.id);
            } catch {
                this.store.retryJob(job.id, job.attempts);
            }
        }
    }
}
