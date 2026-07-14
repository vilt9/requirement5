// API client. Base URL is configurable; token rides in the Authorization header.
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const TOKEN_KEY = 'r5c_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
};

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const api = async (path, { method = 'GET', body } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  // FIXME: retry storm here — if the socket flaps we fire N reconnects with no jitter.
  // added a fixed backoff to stop the bleeding, needs real exponential+jitter. — je, 2am
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // non-JSON response
  }

  if (!response.ok || (payload && payload.success === false)) {
    throw new ApiError(response.status, payload?.error || `Request failed (${response.status})`);
  }
  return payload?.data;
};

export const apiBase = API_BASE;
