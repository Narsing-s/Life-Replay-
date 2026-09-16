const test = require('node:test');
const assert = require('node:assert/strict');

process.env.TOKEN_ENCRYPTION_KEY = 'test-key-that-is-long-enough-for-production-shape-1234567890';
const { encrypt, decrypt } = require('../../production-integrations');

test('production integration token encryption round trips', () => {
  const encrypted = encrypt('google-refresh-token-secret');
  assert.ok(Buffer.isBuffer(encrypted));
  assert.notEqual(encrypted.toString('base64'), 'google-refresh-token-secret');
  assert.equal(decrypt(encrypted), 'google-refresh-token-secret');
});

test('production integration token encryption rejects tampering', () => {
  const encrypted = encrypt('access-token');
  encrypted[encrypted.length - 1] ^= 1;
  assert.throws(() => decrypt(encrypted));
});
