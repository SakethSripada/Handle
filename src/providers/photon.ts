import { Spectrum, type Space } from 'spectrum-ts';
import { imessage } from 'spectrum-ts/providers/imessage';
import type { Config } from '../config.js';
import type { Incoming, Messenger } from '../core/model.js';

export class Photon implements Messenger {
    private app?: Awaited<ReturnType<typeof Spectrum>>;
    private spaces = new Map<string, Space>();
    status = 'not_configured';

    constructor(private config: Config) {}

    async connect(receive: (input: Incoming) => void) {
        if (!this.config.PHOTON_PROJECT_SECRET) {
            return;
        }

        this.status = 'connecting';
        this.app = await Spectrum({
            projectId: this.config.PHOTON_PROJECT_ID,
            projectSecret: this.config.PHOTON_PROJECT_SECRET,
            providers: [imessage.config()],
        });
        this.status = 'connected';

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

            const owner = msg.sender?.address ?? message.sender.id;

            this.spaces.set(space.id, space);

            try {
                receive({
                    id: message.id,
                    owner,
                    spaceId: space.id,
                    line: dm.phone,
                    text: message.content.text,
                });
            } catch (error) {
                console.warn(
                    'Ignored Photon message:',
                    (error as Error).message,
                );
            }
        }

        this.status = 'disconnected';
    }

    async send(spaceId: string, text: string, line?: string) {
        if (!this.app) {
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
