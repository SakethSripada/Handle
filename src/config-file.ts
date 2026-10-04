import { readFileSync, writeFileSync, renameSync, chmodSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

export function saveEnv(values: Record<string, string>, path = '.env') {
    for (const [key, value] of Object.entries(values)) {
        if (!/^[A-Z][A-Z0-9_]*$/.test(key) || /[\r\n\0"]/.test(value)) {
            throw new Error('Invalid environment setting.');
        }
    }

    let source = readFileSync(path, 'utf8');

    for (const [key, value] of Object.entries(values)) {
        const line = `${key}="${value}"`;
        const pattern = new RegExp(`^${key}=.*$`, 'm');

        source = pattern.test(source)
            ? source.replace(pattern, () => line)
            : `${source}\n${line}\n`;
    }

    const temporary = `${path}.${randomUUID()}.tmp`;

    writeFileSync(temporary, source, { mode: 0o600, flag: 'wx' });
    renameSync(temporary, path);
    chmodSync(path, 0o600);
    Object.assign(process.env, values);
}
