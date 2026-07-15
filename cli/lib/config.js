// Persistent CLI state: ~/.r5c/config.json holds the API URL and one entry per
// user the CLI has logged in as. Environment variables override the file:
//   R5C_API_URL  — API base (default https://requirement5.com)
//   R5C_TOKEN    — bearer token (skips the stored credential entirely)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const DEFAULT_API_URL = 'https://requirement5.com';

const CONFIG_DIR = process.env.R5C_CONFIG_DIR || path.join(os.homedir(), '.r5c');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

// The resolved config file path (honors R5C_CONFIG_DIR) — so messages can name
// the real location instead of hardcoding ~/.r5c/config.json.
export function configPath() {
  return CONFIG_PATH;
}

export function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

export function saveConfig(config) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
}

export function apiUrl() {
  const fromEnv = process.env.R5C_API_URL;
  const fromFile = loadConfig().apiUrl;
  return (fromEnv || fromFile || DEFAULT_API_URL).replace(/\/+$/, '');
}

export function token() {
  if (process.env.R5C_TOKEN) return process.env.R5C_TOKEN;
  return loadConfig().token || null;
}

export function setSession({ token: newToken, username }) {
  const config = loadConfig();
  saveConfig({ ...config, token: newToken, username });
}

export function clearSession() {
  const config = loadConfig();
  delete config.token;
  delete config.username;
  saveConfig(config);
}

export function setApiUrl(url) {
  const config = loadConfig();
  saveConfig({ ...config, apiUrl: url.replace(/\/+$/, '') });
}
