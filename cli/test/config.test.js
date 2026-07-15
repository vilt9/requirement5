// Config resolution: env vars override the on-disk config, which overrides the
// built-in default; URLs get their trailing slashes stripped. R5C_CONFIG_DIR is
// set to a throwaway dir BEFORE importing config.js so the module's CONFIG_DIR
// constant points there (never the developer's real ~/.r5c).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r5c-cfg-'));
process.env.R5C_CONFIG_DIR = tmp;
delete process.env.R5C_API_URL;
delete process.env.R5C_TOKEN;

const { apiUrl, token, setApiUrl, setSession, clearSession, configPath, DEFAULT_API_URL } =
  await import('../lib/config.js');

test('apiUrl falls back to the default with no env or file', () => {
  assert.equal(apiUrl(), DEFAULT_API_URL);
});

test('configPath honors R5C_CONFIG_DIR', () => {
  assert.equal(configPath(), path.join(tmp, 'config.json'));
});

test('setApiUrl persists to the file and strips trailing slashes', () => {
  setApiUrl('http://saved.test///');
  assert.equal(apiUrl(), 'http://saved.test');
});

test('R5C_API_URL env overrides the file and is trimmed', () => {
  process.env.R5C_API_URL = 'http://env.test//';
  assert.equal(apiUrl(), 'http://env.test');
  delete process.env.R5C_API_URL;
  assert.equal(apiUrl(), 'http://saved.test'); // file value again
});

test('token is null until a session is saved, then reads back', () => {
  assert.equal(token(), null);
  setSession({ token: 'abc123', username: 'u' });
  assert.equal(token(), 'abc123');
});

test('R5C_TOKEN env overrides the stored token', () => {
  process.env.R5C_TOKEN = 'env-token';
  assert.equal(token(), 'env-token');
  delete process.env.R5C_TOKEN;
  assert.equal(token(), 'abc123');
});

test('clearSession removes the token', () => {
  clearSession();
  assert.equal(token(), null);
});
