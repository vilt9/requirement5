// Thin fetch wrapper around the R5c API. Every response body is
// { success, data | error }; on failure we throw ApiError with the server's
// message so commands can print it verbatim.
import { apiUrl, token } from './config.js';

export class ApiError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export async function request(method, route, { body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const bearer = token();
    if (!bearer) {
      throw new ApiError('Not logged in. Run `r5c login` or `r5c signup` first (or set R5C_TOKEN).', { status: 401 });
    }
    headers.Authorization = `Bearer ${bearer}`;
  }

  let res;
  try {
    res = await fetch(`${apiUrl()}${route}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch (error) {
    throw new ApiError(`Could not reach ${apiUrl()} — ${error.cause?.code || error.message}`, {});
  }

  let payload;
  try {
    payload = await res.json();
  } catch {
    throw new ApiError(`Unexpected non-JSON response (HTTP ${res.status}) from ${route}`, { status: res.status });
  }

  if (!res.ok || payload.success === false) {
    // The token hint only makes sense when a token was actually sent — i.e. an
    // authenticated request. A 401 from login/signup means bad credentials, not
    // a stale token, so don't tell the user to re-run `r5c login`.
    const hint = (res.status === 401 && auth) ? ' (token missing/expired — run `r5c login`)'
      : res.status === 402 ? ' (not enough /t26 — check `r5c balance`)'
      : '';
    throw new ApiError(`${payload.error || `HTTP ${res.status}`}${hint}`, { status: res.status, body: payload });
  }
  return payload;
}

export const get = (route, opts) => request('GET', route, opts);
export const post = (route, body, opts = {}) => request('POST', route, { ...opts, body });
export const put = (route, body, opts = {}) => request('PUT', route, { ...opts, body });
export const del = (route, opts) => request('DELETE', route, opts);
