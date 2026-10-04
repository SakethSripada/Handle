import {
    createCipheriv,
    createDecipheriv,
    randomBytes,
    timingSafeEqual,
    createHmac,
} from 'node:crypto';

export const token = () => randomBytes(32).toString('hex');

export function equal(a: string, b: string): boolean {
    const x = Buffer.from(a);
    const y = Buffer.from(b);

    return x.length === y.length && timingSafeEqual(x, y);
}

export function seal(value: unknown, key: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
    const data = Buffer.concat([
        cipher.update(JSON.stringify(value), 'utf8'),
        cipher.final(),
    ]);

    return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}

export function unseal<T>(value: string, key: string): T {
    const data = Buffer.from(value, 'base64');
    const cipher = createDecipheriv(
        'aes-256-gcm',
        Buffer.from(key, 'hex'),
        data.subarray(0, 12),
    );

    cipher.setAuthTag(data.subarray(12, 28));

    return JSON.parse(
        Buffer.concat([
            cipher.update(data.subarray(28)),
            cipher.final(),
        ]).toString(),
    ) as T;
}

export function verifyElevenSignature(
    body: Buffer,
    header: string,
    secret: string,
    now = Date.now(),
): boolean {
    if (!secret) {
        return false;
    }

    const parts = header.split(',').map((p) => p.trim().split('='));
    const timestamp = parts.find(([k]) => k === 't')?.[1];

    if (
        !timestamp ||
        !/^\d+$/.test(timestamp) ||
        Math.abs(now / 1000 - Number(timestamp)) > 300
    ) {
        return false;
    }

    const expected = createHmac('sha256', secret)
        .update(timestamp + '.')
        .update(body)
        .digest('hex');

    return parts.some(([k, v]) => k === 'v0' && equal(v ?? '', expected));
}
