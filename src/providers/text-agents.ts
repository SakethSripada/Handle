import type { Config } from '../config.js';
import { planSchema } from '../core/intake.js';
import { verdictSchema } from '../core/outcome-verification.js';
import { intakePrompt, verifierPrompt } from '../core/prompts.js';
import { ElevenLabs } from './elevenlabs.js';
import { Gemini } from './gemini.js';

export class TextAgents {
    readonly gemini: Gemini;

    constructor(
        private config: Config,
        private voice: ElevenLabs,
    ) {
        this.gemini = new Gemini(config);
    }

    get provider() {
        return this.config.TEXT_PROVIDER === 'auto'
            ? this.config.GEMINI_API_KEY
                ? 'gemini'
                : 'elevenlabs'
            : this.config.TEXT_PROVIDER;
    }

    get configured() {
        return this.provider === 'gemini'
            ? Boolean(this.config.GEMINI_API_KEY)
            : Boolean(
                  this.config.ELEVENLABS_INTAKE_AGENT_ID &&
                  this.config.ELEVENLABS_VERIFIER_AGENT_ID,
              );
    }

    intake(input: string) {
        return this.provider === 'gemini'
            ? this.gemini.structured(intakePrompt, input, planSchema)
            : this.voice.text(input);
    }

    verify(input: string) {
        if (this.provider === 'gemini') {
            return this.gemini.structured(
                verifierPrompt,
                input,
                verdictSchema,
                20000,
            );
        }

        if (!this.config.ELEVENLABS_VERIFIER_AGENT_ID) {
            throw new Error('Outcome verifier is not configured.');
        }

        return this.voice.text(
            input,
            this.config.ELEVENLABS_VERIFIER_AGENT_ID,
            20000,
        );
    }

    async check() {
        if (this.provider === 'gemini') {
            await this.gemini.request('');
        } else {
            if (!this.configured) {
                throw new Error('Text agents are not configured.');
            }

            await this.voice.request(
                `/convai/agents/${this.config.ELEVENLABS_INTAKE_AGENT_ID}`,
            );
            await this.voice.request(
                `/convai/agents/${this.config.ELEVENLABS_VERIFIER_AGENT_ID}`,
            );
        }
    }
}
