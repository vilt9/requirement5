// End-to-end checks of the bin: help/version aliases, exit codes, and that an
// auth-required command fails cleanly when logged out. Each run spawns the real
// bin as a subprocess; none of these commands need a server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const BIN = fileURLToPath(new URL('../bin/r5c.js', import.meta.url));

function run(args, env = {}) {
  try {
    const stdout = execFileSync('node', [BIN, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env }
    });
    return { code: 0, stdout, stderr: '' };
  } catch (e) {
    return { code: e.status ?? 1, stdout: e.stdout?.toString() ?? '', stderr: e.stderr?.toString() ?? '' };
  }
}

test('help renders and exits 0', () => {
  const r = run(['help']);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /Requirement5cards from the command line/);
});

test('no args prints help', () => {
  const r = run([]);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /USAGE/);
});

test('--help and -h alias to help', () => {
  for (const flag of ['--help', '-h']) {
    const r = run([flag]);
    assert.equal(r.code, 0, `${flag} exits 0`);
    assert.match(r.stdout, /USAGE/, `${flag} shows help`);
  }
});

test('version / --version / -v print the package version', () => {
  for (const flag of ['version', '--version', '-v']) {
    const r = run([flag]);
    assert.equal(r.code, 0, `${flag} exits 0`);
    assert.match(r.stdout, /^r5c \d+\.\d+\.\d+/m, `${flag} prints a semver`);
  }
});

test('an unknown command exits 1', () => {
  assert.equal(run(['definitely-not-a-command']).code, 1);
});

test('template minimal prints valid JSON and exits 0', () => {
  const r = run(['template', 'minimal']);
  assert.equal(r.code, 0);
  const obj = JSON.parse(r.stdout);
  assert.equal(typeof obj.name, 'string');
});

test('template with an unknown name exits 1', () => {
  assert.equal(run(['template', 'nonsense']).code, 1);
});

test('an auth-required command while logged out fails cleanly (exit 1, no crash)', () => {
  const r = run(['balance'], { R5C_CONFIG_DIR: `/tmp/r5c-none-${Date.now()}`, R5C_TOKEN: '' });
  assert.equal(r.code, 1);
  assert.match(r.stderr, /Not logged in/);
});
