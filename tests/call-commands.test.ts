import test from 'node:test';
import assert from 'node:assert/strict';
import { stopCommand } from '../src/core/call-commands.js';

test('stop commands recognize clear hangup requests and reject negations or business goals', () => {
    for (const text of [
        'end the call',
        'Hang up!',
        'Please stop the call now.',
        'stop',
        'cancel request',
    ]) {
        assert.equal(stopCommand(text), 'current');
    }

    for (const text of ['End all calls', 'Stop all my calls now!']) {
        assert.equal(stopCommand(text), 'all');
    }

    for (const text of [
        "Don't end the call",
        'Do not hang up',
        'Ask them to cancel my appointment',
        'What happens if I end the call?',
    ]) {
        assert.equal(stopCommand(text), undefined);
    }
});
