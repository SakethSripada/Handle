import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const cli = process.env.SPACETIME_CLI ?? 'spacetime';
const result = spawnSync(
    cli,
    [
        'generate',
        '--lang',
        'typescript',
        '--module-path',
        'spacetimedb',
        '--out-dir',
        'src/generated',
        '--include-private',
        '--yes',
    ],
    { stdio: 'inherit' },
);

if (result.status !== 0) {
    process.exit(result.status ?? 1);
}

function normalize(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = `${directory}/${entry.name}`;

        if (entry.isDirectory()) {
            normalize(path);
        } else if (entry.name.endsWith('.ts')) {
            const source = readFileSync(path, 'utf8').replace(
                /(from ['"])(\.[^'"]+)(['"])/g,
                (_match, start, name, end) =>
                    `${start}${name.endsWith('.js') ? name : `${name}.js`}${end}`,
            );

            writeFileSync(path, `// @ts-nocheck\n${source}`);
        }
    }
}

normalize('src/generated');
