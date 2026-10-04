export class ProviderError extends Error {
    constructor(
        public provider: string,
        public status: number,
        public detail: string,
    ) {
        super(`${provider} returned ${status}: ${detail.slice(0, 300)}`);
    }
}

export async function jsonRequest<T>(
    provider: string,
    url: string,
    init: RequestInit = {},
): Promise<T> {
    const response = await fetch(url, {
        ...init,
        signal: init.signal ?? AbortSignal.timeout(25000),
    });
    const text = await response.text();

    if (!response.ok) {
        throw new ProviderError(provider, response.status, text);
    }

    return (text ? JSON.parse(text) : {}) as T;
}
