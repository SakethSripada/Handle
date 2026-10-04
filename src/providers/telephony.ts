import twilio from 'twilio';
import type { Config } from '../config.js';
import { normalizePhone } from '../core/intake.js';

export class Telephony {
    constructor(private config: Config) {}

    get configured() {
        return Boolean(
            this.config.TWILIO_ACCOUNT_SID && this.config.TWILIO_AUTH_TOKEN,
        );
    }

    private client() {
        if (!this.configured) {
            throw new Error('Twilio credentials are not configured.');
        }

        return twilio(
            this.config.TWILIO_ACCOUNT_SID,
            this.config.TWILIO_AUTH_TOKEN,
        );
    }

    async inspect() {
        const client = this.client();
        const [account, numbers] = await Promise.all([
            client.api.accounts(this.config.TWILIO_ACCOUNT_SID).fetch(),
            client.incomingPhoneNumbers.list({ limit: 100 }),
        ]);

        return {
            type: account.type,
            active: account.status === 'active',
            numbers: numbers.filter((number) => number.capabilities.voice),
        };
    }

    async validateDestination(destination: string) {
        const phone = normalizePhone(destination);

        if (!phone || phone !== destination) {
            throw new Error('A valid destination number is required.');
        }

        const info = await this.inspect();

        if (!info.active) {
            throw new Error('The Twilio account is not active.');
        }

        if (
            !info.numbers.some(
                (number) =>
                    number.phoneNumber === this.config.TWILIO_PHONE_NUMBER,
            )
        ) {
            throw new Error(
                'The configured caller number is not an owned Twilio voice number.',
            );
        }

        if (info.type === 'Trial') {
            throw new Error(
                'Twilio trial accounts block the audio streaming used by ElevenLabs. Upgrade before native voice tests.',
            );
        }
    }
}
