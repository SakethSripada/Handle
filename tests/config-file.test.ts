import test from 'node:test';
import assert from 'node:assert/strict';
import {
    mkdtempSync,
    readFileSync,
    writeFileSync,
    statSync,
    rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'dotenv';
import { saveEnv } from '../src/config-file.js';
import { senderAddress } from '../src/providers/photon.js';
import { ProviderError } from '../src/providers/http.js';

test('credential writes preserve literal values and file privacy', () => {
    const dir = mkdtempSync(join(tmpdir(), 'handle-config-'));
    const path = join(dir, '.env');

    try {
        writeFileSync(path, 'HANDLE_TEST_KEY=old\nHANDLE_OTHER=keep\n');
        saveEnv({ HANDLE_TEST_KEY: 'literal-$&-#-value' }, path);
        assert.equal(
            parse(readFileSync(path)).HANDLE_TEST_KEY,
            'literal-$&-#-value',
        );
        assert.equal(parse(readFileSync(path)).HANDLE_OTHER, 'keep');
        assert.equal(statSync(path).mode & 0o777, 0o600);
        assert.throws(() =>
            saveEnv({ HANDLE_TEST_KEY: 'value\nINJECTED=true' }, path),
        );
        assert.equal(
            parse(readFileSync(path)).HANDLE_TEST_KEY,
            'literal-$&-#-value',
        );
    } finally {
        delete process.env.HANDLE_TEST_KEY;
        rmSync(dir, { recursive: true });
    }
});

test('provider response bodies never become user-visible error messages', () => {
    const error = new ProviderError(
        'Example',
        401,
        'private-token-and-personal-data',
    );

    assert.doesNotMatch(error.message, /private-token/);
});

test('iMessage sender formatting does not change allowlist matching', () => {
    assert.equal(senderAddress('(202) 555-0142'), '+12025550142');
    assert.equal(senderAddress('+1 (202) 555-0142'), '+12025550142');
    assert.equal(
        senderAddress('customer42@example.test'),
        'customer42@example.test',
    );
});
