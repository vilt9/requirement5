#!/usr/bin/env node
// r5c — command-line client for Requirement5 cards.
// Zero dependencies; talks to the same JSON API as the web app.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import * as api from '../lib/api.js';
import { apiUrl, token, loadConfig, setSession, clearSession, setApiUrl, configPath, DEFAULT_API_URL } from '../lib/config.js';
import { buildPublishPayload, TEMPLATES, SpecError } from '../lib/spec.js';
import { HELP, COMMAND_HELP } from '../lib/help.js';

// ---------- tiny argv parsing: `r5c <command> [positional...] [--flag value|--flag]`
const BOOLEAN_FLAGS = new Set(['open', 'json', 'help', 'full', 'mine', 'public', 'private']);

function parseArgv(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const name = arg.slice(2);
      if (BOOLEAN_FLAGS.has(name) || i + 1 >= argv.length || argv[i + 1].startsWith('--')) {
        flags[name] = true;
      } else {
        flags[name] = argv[++i];
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

const out = (value) => console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2));

// The installed package version, read from package.json next to this bin.
function pkgVersion() {
  try {
    return JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
  } catch {
    return 'unknown';
  }
}

function fail(message) {
  console.error(`r5c: ${message}`);
  process.exit(1);
}

// Opens a URL in the default browser without stealing focus from the terminal
// workflow — only ever runs when --open is passed explicitly.
function openUrl(url) {
  const cmd = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'start'
    : 'xdg-open';
  spawn(cmd, [url], { stdio: 'ignore', detached: true }).unref();
}

const cardUrl = (id) => `${apiUrl()}/card/${id}`;

// A balance line for any command that moves /t26 — and, when the balance is
// negative, a short explainer of the overdraft rules (mirrors the server:
// -1000 floor, 1.47%/day interest).
function balanceReport(balance) {
  if (typeof balance !== 'number') return '';
  if (balance >= 0) return `  Balance: ${balance} /t26`;
  return [
    `  Balance: ${balance} /t26  (in debt)`,
    `    Debt accrues 1.47%/day interest, compounding. You can spend down to`,
    `    −1000 /t26; at the floor, spending is blocked until you earn back (generate).`
  ].join('\n');
}

async function promptHidden(label) {
  // Password prompt that works in pipes too (agents pass --password instead).
  process.stderr.write(label);
  return new Promise((resolve) => {
    let value = '';
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      stdin.setEncoding('utf8');
      stdin.on('data', (d) => { value += d; });
      stdin.on('end', () => resolve(value.trim()));
      return;
    }
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (char) => {
      if (char === '\n' || char === '\r' || char === '') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stderr.write('\n');
        resolve(value);
      } else if (char === '') { // ctrl-c
        process.stderr.write('\n');
        process.exit(130);
      } else if (char === '') {
        value = value.slice(0, -1);
      } else {
        value += char;
      }
    };
    stdin.on('data', onData);
  });
}

// ---------- commands

async function cmdSignup({ flags }) {
  const username = flags.username || fail('signup needs --username (3-24 chars: letters, numbers, underscore)');
  const email = flags.email || fail('signup needs --email');
  const password = flags.password || await promptHidden('Password (min 8 chars): ');
  const { data } = await api.post('/api/auth/signup', { username, email, password });
  setSession({ token: data.token, username: data.user.username });
  out(flags.json ? data : `Signed up and logged in as ${data.user.username}. Starting balance: ${data.user.balance} /t26.`);
}

async function cmdLogin({ flags }) {
  // Accept a username or an email as the identifier (--username kept for habit).
  const identifier = flags.username || flags.email || fail('login needs --username (or --email)');
  const password = flags.password || await promptHidden('Password: ');
  const { data } = await api.post('/api/auth/login', { identifier, password });
  setSession({ token: data.token, username: data.user.username });
  out(flags.json ? data : `Logged in as ${data.user.username} (${apiUrl()}). Balance: ${data.user.balance} /t26.`);
}

async function cmdLogout() {
  clearSession();
  out(`Logged out (token removed from ${configPath()}).`);
}

async function cmdWhoami({ flags }) {
  const { data } = await api.get('/api/auth/me', { auth: true });
  out(flags.json ? data : `${data.username} — balance ${data.balance} /t26 — ${apiUrl()}`);
}

async function cmdBalance({ flags }) {
  const { data } = await api.get('/api/economy/balance', { auth: true });
  out(flags.json ? data : `${data.balance} /t26`);
}

async function cmdTransactions({ flags }) {
  const { data } = await api.get('/api/economy/transactions', { auth: true });
  out(data);
}

// ---------- guided card creation: `r5c card create ...` ----------
// Mirrors the website's /create flow and its exact wording: begin → regenerate
// the Rarity Value → confirm-start (pay the create fee, lock it onto a private
// draft) → design the draft (update/preview) → publish (release it into the
// pool). The rarity is a server-owned gamble; you never declare it.

// One line that says what a Rarity Value MEANS: the number, its tier, and the
// odds a card that rare appears at ("1 in 220").
function rarityLine(d) {
  const t = d.tier || {};
  const meaning = t.odds ? `appears at 1 in ${t.odds}` : 'the common run';
  return `Rarity Value: ${d.rarityValue}  ·  ${t.name || '—'}  (${meaning})`;
}

async function cardBegin({ flags }) {
  const { data } = await api.post('/api/cards/create/begin', {}, { auth: true });
  if (flags.json) return out(data);
  out(rarityLine(data));
  out(`  regenerations so far: ${data.regenerations}`);
  out(`  regenerate: −${data.prices.regenerate} /t26   ·   confirm-start (create fee): −${data.prices.confirmStart} /t26`);
  out(balanceReport(data.balance));
  out('Next: `r5c card create regenerate-rarity` to gamble again, or `r5c card create confirm-start [spec.json]` to lock it in.');
}

async function cardRegen({ flags }) {
  const { data } = await api.post('/api/cards/create/regenerate-rarity', {}, { auth: true });
  if (flags.json) return out(data);
  out(`${rarityLine(data)}   [−${data.charged} /t26]`);
  out(`  next regenerate: −${data.prices.regenerate} /t26   ·   confirm-start: −${data.prices.confirmStart} /t26`);
  out(balanceReport(data.balance));
}

async function cardConfirm({ positional, flags }) {
  const specPath = positional[0];
  let payload = {};
  if (specPath) {
    let spec;
    try {
      spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
    } catch (error) {
      fail(`could not read spec ${specPath}: ${error.message}`);
    }
    payload = buildPublishPayload(spec, path.dirname(path.resolve(specPath)));
  }
  const { data } = await api.post('/api/cards/create/confirm-start', payload, { auth: true });
  if (flags.json) return out(data);
  out(`Confirmed — rarity locked at ${data.rarityValue} (${data.tier.name}). Private draft ${data.draft.id} created.`);
  out(`  Create fee: −${data.createFee} /t26${data.imagesStored ? ` — images stored: ${data.imagesStored}` : ''}`);
  out(balanceReport(data.balance));
  out(`Next: design it — \`r5c card create update ${data.draft.id} card.json\`, look with \`r5c card create preview ${data.draft.id}\`, then \`r5c card create publish ${data.draft.id}\`.`);
}

async function cardStatus({ flags }) {
  const { data } = await api.get('/api/cards/create/status', { auth: true });
  if (flags.json) return out(data);
  if (data.rarity) {
    out(rarityLine(data.rarity));
    out(`  regenerate: −${data.rarity.prices.regenerate} /t26   ·   confirm-start: −${data.rarity.prices.confirmStart} /t26`);
  } else {
    out('No Rarity Value in progress — `r5c card create begin` to start one.');
  }
  if (data.drafts.length) {
    out('Private drafts (not yet published):');
    for (const d of data.drafts) out(`  ${d.id}  ${String(d.tier || '-').padEnd(9)} ${d.name}`);
  }
  out(balanceReport(data.balance));
}

async function cardCreatePublish({ positional, flags }) {
  const id = positional[0];
  const { data } = await api.post('/api/cards/create/publish', id ? { id } : {}, { auth: true });
  const url = cardUrl(data.card.id);
  if (flags.json) return out({ ...data, url });
  out(`Published "${data.card.name}" — rarity ${data.card.rarity_score} (${data.card.tier})`);
  out(`  ${url}`);
  out(balanceReport(data.balance));
  if (flags.open) openUrl(url);
}

// Dispatch `r5c card create <action> ...`.
async function cmdCard({ positional, flags }) {
  const [sub, action, ...rest] = positional;
  if (sub !== 'create') {
    fail(`unknown "r5c card ${sub || ''}" — the guided flow is \`r5c card create ...\``);
  }
  const inner = { positional: rest, flags };
  const actions = {
    begin: cardBegin,
    'regenerate-rarity': cardRegen,
    'confirm-start': cardConfirm,
    status: cardStatus,
    update: cmdUpdate,             // shape the private draft (PUT the card)
    preview: cmdPreview,           // look at the private draft
    publish: cardCreatePublish,    // release the draft into the pool
    release: cardCreatePublish     // friendly alias for publish
  };
  const handler = actions[action];
  if (!handler) {
    fail(`unknown "r5c card create ${action || ''}" — try: begin | regenerate-rarity | confirm-start | update | preview | publish | status`);
  }
  return handler(inner);
}

async function cmdConfig({ positional, flags }) {
  if (flags['api-url']) {
    setApiUrl(flags['api-url']);
    out(`API URL set to ${flags['api-url']}`);
    return;
  }
  const config = loadConfig();
  out({
    apiUrl: apiUrl(),
    apiUrlSource: process.env.R5C_API_URL ? 'env:R5C_API_URL' : config.apiUrl ? 'config' : `default (${DEFAULT_API_URL})`,
    loggedInAs: config.username || null,
    tokenSource: process.env.R5C_TOKEN ? 'env:R5C_TOKEN' : token() ? 'config' : null
  });
}

async function cmdUpdate({ positional, flags }) {
  const id = positional[0] || fail('update needs a card id: r5c card create update <id> <spec.json>');
  const specPath = positional[1] || fail('update needs a spec file: r5c card create update <id> card.json');
  let spec;
  try {
    spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  } catch (error) {
    fail(`could not read spec ${specPath}: ${error.message}`);
  }

  // Same expansion as publish: the spec fully describes the new design and
  // replaces the card's state. No new stake — the card was already staked.
  const payload = buildPublishPayload(spec, path.dirname(path.resolve(specPath)));
  const { data } = await api.put(`/api/cards/${id}`, payload, { auth: true });

  const url = cardUrl(data.card.id);
  if (flags.json) {
    out({ ...data, url });
  } else {
    out(`Updated "${data.card.name}" (${data.card.tier}, rarity ${data.card.rarity_score})`);
    out(`  ${url}`);
  }
  if (flags.open) openUrl(url);
}

async function cmdGet({ positional, flags }) {
  const id = positional[0] || fail('get needs a card id');
  const { data } = await api.get(`/api/cards/${id}`);
  out(data);
}

async function cmdList({ flags }) {
  const route = flags.mine ? '/api/cards/published/mine' : '/api/cards/community/all';
  const { data } = await api.get(route, { auth: !!flags.mine });
  if (flags.json) return out(data);
  const rows = (flags.mine ? data.map((r) => ({ ...r.card, saves: r.stats?.timesSaved })) : data);
  if (!rows.length) return out('No cards.');
  for (const card of rows) {
    out(`${card.id}  ${String(card.tier || '-').padEnd(9)} ${card.name}`);
  }
}

async function cmdCollection({ flags }) {
  const { data } = await api.get('/api/cards/collection/mine', { auth: true });
  if (flags.json) return out(data);
  if (!data.length) return out('Collection is empty.');
  for (const { card } of data) {
    out(`${card.id}  ${String(card.tier || '-').padEnd(9)} ${card.name}`);
  }
}

async function cmdDelete({ positional }) {
  const id = positional[0] || fail('delete needs a card id');
  await api.del(`/api/cards/${id}`, { auth: true });
  out(`Deleted card ${id}.`);
}

async function cmdRender({ positional, flags }) {
  const id = positional[0] || fail('render needs a card id');
  let format = 'gif';
  if (flags.format !== undefined) {
    if (flags.format === 'gif' || flags.format === 'mp4') format = flags.format;
    else process.stderr.write(`r5c: ignoring --format "${flags.format}" (use gif or mp4); rendering gif\n`);
  }
  out(`Rendering ${id} as ${format} (first render takes ~30s)...`);
  const { data } = await api.get(`/api/cards/${id}/render?format=${format}`);
  out(data.url);
  if (flags.open) openUrl(data.url);
}

async function cmdPreview({ positional, flags }) {
  const id = positional[0] || fail('preview needs a card id');
  let count = 4;
  if (flags.frames !== undefined) {
    const n = parseInt(flags.frames, 10);
    if (Number.isNaN(n)) {
      process.stderr.write(`r5c: ignoring --frames "${flags.frames}" (not a number); using ${count}\n`);
    } else {
      count = Math.max(1, Math.min(8, n));
      if (n !== count) process.stderr.write(`r5c: --frames ${n} out of range 1-8; using ${count}\n`);
    }
  }
  if (!flags.json) out(`Capturing ${count} still frame(s) of ${id} (rest pose + orbit poses)...`);
  const { data } = await api.get(`/api/cards/${id}/render?format=frames&count=${count}`);
  // Local storage hands back relative /uploads/... paths; resolve against the API.
  const urls = (data.urls || []).map((u) => new URL(u, apiUrl()).href);

  if (flags.out) {
    fs.mkdirSync(flags.out, { recursive: true });
    const files = [];
    for (let i = 0; i < urls.length; i++) {
      const res = await fetch(urls[i]);
      if (!res.ok) fail(`could not download frame ${i}: HTTP ${res.status}`);
      const file = path.join(flags.out, `${id}_frame${i}.png`);
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      files.push(file);
    }
    if (flags.json) return out({ id, urls, files });
    for (const f of files) out(f);
    return;
  }

  if (flags.json) return out({ id, urls });
  for (const u of urls) out(u);
}

async function cmdOpen({ positional }) {
  const id = positional[0] || fail('open needs a card id');
  const url = cardUrl(id);
  out(url);
  openUrl(url);
}

async function cmdTemplate({ positional, flags }) {
  const which = positional[0] || (flags.full ? 'full' : 'minimal');
  const template = TEMPLATES[which];
  if (!template) fail(`unknown template "${which}" — available: ${Object.keys(TEMPLATES).join(', ')}`);
  out(template);
}

const COMMANDS = {
  signup: cmdSignup,
  login: cmdLogin,
  logout: cmdLogout,
  whoami: cmdWhoami,
  balance: cmdBalance,
  transactions: cmdTransactions,
  config: cmdConfig,
  card: cmdCard, // the guided creation flow: `r5c card create ...`
  get: cmdGet,
  list: cmdList,
  collection: cmdCollection,
  delete: cmdDelete,
  render: cmdRender,
  open: cmdOpen,
  template: cmdTemplate
};

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const parsed = parseArgv(rest);

  if (command === 'version' || command === '--version' || command === '-v' || parsed.flags.version) {
    out(`r5c ${pkgVersion()}`);
    return;
  }

  if (!command || command === 'help' || command === '--help' || command === '-h' || parsed.flags.help) {
    const topic = command === 'help' ? parsed.positional[0] : command;
    out(COMMAND_HELP[topic] || HELP);
    return;
  }

  const handler = COMMANDS[command];
  if (!handler) fail(`unknown command "${command}" — run \`r5c help\``);

  try {
    await handler(parsed);
  } catch (error) {
    if (error instanceof api.ApiError || error instanceof SpecError) fail(error.message);
    throw error;
  }
}

main().catch((error) => fail(error.stack || error.message));
