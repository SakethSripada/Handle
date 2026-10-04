import { z } from 'zod';
import type { Config } from '../config.js';
import { jsonRequest, ProviderError } from './http.js';
import { setTimeout as delay } from 'node:timers/promises';

interface Generation {
    candidates?: {
        finishReason?: string;
        content?: { parts?: { text?: string; thought?: boolean }[] };
    }[];
}

// These contracts use flat string/boolean fields. Keep validation limits local
// and send only the JSON Schema features supported by the model API.
function responseSchema(schema: z.ZodObject) {
    const json = z.toJSONSchema(schema);

    return {
        type: 'object',
        properties: Object.fromEntries(
            Object.entries(json.properties ?? {}).map(([key, value]) => [
                key,
                { type: (value as { type: string }).type },
            ]),
        ),
        required: Object.keys(json.properties ?? {}),
        additionalProperties: false,
    };
}

export class Gemini {
    constructor(private config: Config) {}

    request<T>(
        operation: '' | ':generateContent',
        body?: unknown,
        timeoutMs = 25000,
    ) {
        if (!this.config.GEMINI_API_KEY) {
            throw new Error('Add GEMINI_API_KEY to the local .env file.');
        }

        return jsonRequest<T>(
            'Gemini',
            `https://generativelanguage.googleapis.com/v1beta/models/${this.config.GEMINI_MODEL}${operation}`,
            {
                method: body === undefined ? 'GET' : 'POST',
                headers: {
                    'x-goog-api-key': this.config.GEMINI_API_KEY,
                    'Content-Type': 'application/json',
                },
                signal: AbortSignal.timeout(timeoutMs),
                ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            },
        );
    }

    async structured(
        system: string,
        input: string,
        schema: z.ZodObject,
        timeoutMs = 45000,
    ) {
        const result = await this.generate(
            {
                systemInstruction: { parts: [{ text: system }] },
                contents: [{ role: 'user', parts: [{ text: input }] }],
                generationConfig: {
                    temperature: 0,
                    maxOutputTokens: 8192,
                    responseMimeType: 'application/json',
                    responseJsonSchema: responseSchema(schema),
                },
            },
            timeoutMs,
        );
        const candidate = result.candidates?.[0];
        const answer = candidate?.content?.parts
            ?.filter((part) => !part.thought)
            .map((part) => part.text ?? '')
            .join('');

        if (candidate?.finishReason !== 'STOP' || !answer?.trim()) {
            throw new Error(
                'Gemini did not return a complete response. No new action was authorized.',
            );
        }

        try {
            return JSON.stringify(schema.parse(JSON.parse(answer)));
        } catch {
            throw new Error(
                'Gemini returned an invalid structured response. No new action was authorized.',
            );
        }
    }

    private async generate(
        body: unknown,
        timeoutMs: number,
    ): Promise<Generation> {
        try {
            return await this.request<Generation>(
                ':generateContent',
                body,
                timeoutMs,
            );
        } catch (error) {
            if (
                !(error instanceof ProviderError) ||
                ![500, 502, 503, 504].includes(error.status)
            ) {
                throw error;
            }

            // Retry transient generation failures once; no call or business action
            // has been dispatched while a text response is being prepared.
            await delay(750);

            return this.request<Generation>(
                ':generateContent',
                body,
                timeoutMs,
            );
        }
    }
}
