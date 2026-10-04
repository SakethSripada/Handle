import { z } from 'zod';

const schema = z.object({
    PORT: z.coerce.number().default(4310),
    PUBLIC_URL: z.string().url().default('http://localhost:4310'),
    DASHBOARD_TOKEN: z.string().min(24),
    ENCRYPTION_KEY: z.string().regex(/^[a-f0-9]{64}$/),
    PHOTON_PROJECT_ID: z.string().default(''),
    PHOTON_PROJECT_SECRET: z.string().default(''),
    ELEVENLABS_API_KEY: z.string().default(''),
    ELEVENLABS_AGENT_ID: z.string().default(''),
    ELEVENLABS_INTAKE_AGENT_ID: z.string().default(''),
    ELEVENLABS_PHONE_NUMBER_ID: z.string().default(''),
    ELEVENLABS_WEBHOOK_SECRET: z.string().default(''),
    TWILIO_ACCOUNT_SID: z.string().default(''),
    TWILIO_AUTH_TOKEN: z.string().default(''),
    TWILIO_PHONE_NUMBER: z.string().default(''),
    SPACETIMEDB_URL: z.string().default('https://maincloud.spacetimedb.com'),
    SPACETIMEDB_DATABASE: z.string().default(''),
    SPACETIMEDB_TOKEN: z.string().default(''),
    GOOGLE_CLIENT_ID: z.string().default(''),
    GOOGLE_CLIENT_SECRET: z.string().default(''),
    ALLOWED_SENDERS: z.string().default(''),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(): Config {
    return schema.parse(process.env);
}
