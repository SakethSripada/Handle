import { Spectrum, SpectrumCloudError, type Space } from 'spectrum-ts';
import { imessage } from 'spectrum-ts/providers/imessage';
import { setTimeout as delay } from 'node:timers/promises';
import type { Config } from '../config.js';
import type { Incoming, Messenger } from '../core/model.js';
import { normalizePhone } from '../core/intake.js';

export function senderAddress(address: string) {
    return /^\+?[\d ()-]+$/.test(address) ? normalizePhone(address) : address;
}

export class Photon implements Messenger {
    private app?: Awaited<ReturnType<typeof Spectrum>>;
    private spaces = new Map<string, Space>();
    private task?: Promise<void>;
    private shutdown = new AbortController();
    status = 'not_configured';
    lastInboundAt?: number;
    lastError?: string;

    constructor(private config: Config) {}

    connect(receive: (input: Incoming) => void) {
        this.task ??= this.run(receive);

        return this.task;
    }

    private async run(receive: (input: Incoming) => void) {
        let failures = 0;

        while (!this.shutdown.signal.aborted) {
            if (!this.config.PHOTON_PROJECT_SECRET) {
                this.status = 'not_configured';
            } else {
                try {
                    this.status = 'connecting';
                    this.app = await Spectrum({
                        projectId: this.config.PHOTON_PROJECT_ID,
                        projectSecret: this.config.PHOTON_PROJECT_SECRET,
                        providers: [imessage.config()],
                    });

                    if (this.shutdown.signal.aborted) {
                        break;
                    }

                    this.status = 'connected';
                    this.lastError = undefined;
                    failures = 0;

                    for await (const [space, message] of this.app.messages) {
                        if (
                            message.direction !== 'inbound' ||
                            message.platform !== 'imessage' ||
                            message.content.type !== 'text'
                        ) {
                            continue;
                        }

                        const dm = imessage(space);
                        const msg = imessage(message);

                        if (dm.type !== 'dm' || !message.sender) {
                            continue;
                        }

                        const owner = senderAddress(
                            msg.sender?.address ?? message.sender.id,
                        );

                        try {
                            receive({
                                id: message.id,
                                owner,
                                spaceId: space.id,
                                line: dm.phone,
                                text: message.content.text,
                            });
                            this.lastInboundAt = Date.now();
                            this.spaces.set(space.id, space);
                        } catch {
                            // Unenrolled senders are ignored without echoing their data into logs.
                        }
                    }

                    this.status = 'retrying';
                } catch (error) {
                    this.status = 'retrying';
                    this.lastError =
                        error instanceof SpectrumCloudError
                            ? `Photon connection needs attention (${error.code}).`
                            : 'Photon is unavailable. Reconnecting automatically.';
                    failures++;
                } finally {
                    await this.app?.stop().catch(() => {});
                    this.app = undefined;
                    this.spaces.clear();
                }
            }

            try {
                await delay(
                    Math.min(30000, 2000 * 2 ** Math.min(failures, 4)),
                    undefined,
                    {
                        signal: this.shutdown.signal,
                    },
                );
            } catch {
                break;
            }
        }

        this.status = 'stopped';
    }

    async stop() {
        this.shutdown.abort();
        await this.app?.stop();
    }

    async send(spaceId: string, text: string, line?: string) {
        if (!this.app || this.status !== 'connected') {
            throw new Error('Photon is not connected.');
        }

        const space =
            this.spaces.get(spaceId) ??
            (await imessage(this.app).space.get(
                spaceId,
                line ? { phone: line } : undefined,
            ));

        await space.send(text);
    }
}
