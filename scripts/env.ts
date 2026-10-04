import { readFileSync, writeFileSync } from 'node:fs';

export function saveEnv(values: Record<string, string>) {
    let source = readFileSync('.env', 'utf8');

    for (const [key, value] of Object.entries(values)) {
        const line = `${key}=${value}`;

        source = new RegExp(`^${key}=.*$`, 'm').test(source)
            ? source.replace(new RegExp(`^${key}=.*$`, 'm'), line)
            : source + '\n' + line + '\n';
        process.env[key] = value;
    }

    writeFileSync('.env', source, { mode: 0o600 });
}
