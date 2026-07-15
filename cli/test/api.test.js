// The fetch wrapper's error mapping. globalThis.fetch is stubbed so no network
// is touched; R5C_CONFIG_DIR points at an empty temp dir so no stored token
// leaks in from the developer's real ~/.r5c.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.R5C_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'r5c-api-'));
process.env.R5C_API_URL = 'http://test.local';
delete process.env.R5C_TOKEN;

const { request, ApiError } = await import('../lib/api.js');

const realFetch = globalThis.fetch;
const jsonRes = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const stub = (res) => { globalThis.fetch = async () => res; };

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.R5C_TOKEN;
});

test('a successful response returns the parsed payload', async () => {
  stub(jsonRes(200, { success: true, data: { x: 1 } }));
  const p = await request('GET', '/x');
  assert.deepEqual(p.data, { x: 1 });
});

test('a 401 on an AUTHENTICATED request appends the token hint', async () => {
  process.env.R5C_TOKEN = 'tok';
  stub(jsonRes(401, { success: false, error: 'Unauthorized' }));
  await assert.rejects(request('GET', '/x', { auth: true }), (e) => {
    assert.ok(e instanceof ApiError);
    assert.match(e.message, /token missing\/expired — run `r5c login`/);
    return true;
  });
});

test('a 401 on an UNAUTHENTICATED request (login/signup) does NOT append the token hint', async () => {
  stub(jsonRes(401, { success: false, error: 'Invalid login or password' }));
  await assert.rejects(request('POST', '/api/auth/login', { auth: false }), (e) => {
    assert.equal(e.message, 'Invalid login or password');
    return true;
  });
});

test('a 402 appends the balance hint', async () => {
  process.env.R5C_TOKEN = 'tok';
  stub(jsonRes(402, { success: false, error: 'Too poor' }));
  await assert.rejects(request('POST', '/x', { auth: true }), /check `r5c balance`/);
});

test('an authenticated request with no token throws before any fetch', async () => {
  let called = false;
  globalThis.fetch = async () => { called = true; return jsonRes(200, {}); };
  await assert.rejects(request('GET', '/x', { auth: true }), /Not logged in/);
  assert.equal(called, false, 'fetch must not run without a token');
});

test('a network failure maps to a "Could not reach" message', async () => {
  globalThis.fetch = async () => { const e = new Error('boom'); e.cause = { code: 'ECONNREFUSED' }; throw e; };
  await assert.rejects(request('GET', '/x'), /Could not reach http:\/\/test\.local — ECONNREFUSED/);
});
