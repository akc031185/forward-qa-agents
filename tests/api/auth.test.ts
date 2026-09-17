import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBearerAuthorized } from '../../src/core/auth.js';

test('refuses when no token is configured, even with a header', () => {
  assert.equal(isBearerAuthorized('Bearer anything', ''), false);
  assert.equal(isBearerAuthorized(undefined, ''), false);
});

test('accepts an exact bearer match', () => {
  assert.equal(isBearerAuthorized('Bearer s3cret', 's3cret'), true);
});

test('rejects a missing header, wrong scheme, wrong token, or trailing noise', () => {
  assert.equal(isBearerAuthorized(undefined, 's3cret'), false);
  assert.equal(isBearerAuthorized('Basic s3cret', 's3cret'), false);
  assert.equal(isBearerAuthorized('Bearer wrong', 's3cret'), false);
  assert.equal(isBearerAuthorized('Bearer s3cret ', 's3cret'), false);
  assert.equal(isBearerAuthorized('bearer s3cret', 's3cret'), false); // case-sensitive scheme
});

test('rejects an array header (should never happen, but must not throw)', () => {
  assert.equal(isBearerAuthorized(['Bearer s3cret'], 's3cret'), false);
});
