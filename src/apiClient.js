// apiClient.js
// Single source of truth for the API origin, URL building, and
// fetch-with-timeout.
//
// Every module used to redeclare `const API_BASE = import.meta.env...` for
// itself and roll its own timeout, which had drifted into three different
// behaviours: 12s in gameAccess.js, 15s in logPlaySession.js, and NO timeout at
// all in playerStore.js. The missing one was the worst of the three, because
// playerStore.hydrate() runs inside AuthBootstrap and gates the entire app
// render — a hung /api/code-lookup left a child staring at the loading screen
// forever, with no error and no way to retry.

export const API_BASE =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

// One shared budget. A Render free instance can take 30-60s to wake from cold,
// so this is deliberately generous; callers that can render a partial UI should
// pass a shorter timeout and keep their cached content instead.
export const DEFAULT_TIMEOUT_MS = 15_000;

// An error carrying the HTTP status, so callers can tell a genuine "this code
// doesn't exist" (401/404) apart from "you've been rate limited" (429) or a
// timeout — three situations that deserve three different messages.
export class ApiError extends Error {
  constructor(message, { status = 0, body = null, isTimeout = false } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.isTimeout = isTimeout;
  }
}

// Appends only the params that actually have a value, so callers can pass a
// big object of optional filters without every one of them producing `x=null`.
export function withQuery(path, params = {}) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value != null && value !== '')
  );
  const qs = query.toString();
  return `${API_BASE}${path}${qs ? `?${qs}` : ''}`;
}

// Combines the caller's signal with the timeout's own. AbortSignal.any() is not
// available on the older tablets this app targets, hence the manual relay.
function combineSignals(externalSignal, timeoutController) {
  if (!externalSignal) return timeoutController.signal;
  if (externalSignal.aborted) {
    timeoutController.abort();
    return timeoutController.signal;
  }
  const relay = () => timeoutController.abort();
  externalSignal.addEventListener('abort', relay, { once: true });
  return timeoutController.signal;
}

// Drop-in equivalent of the old per-file helpers: resolves a Response, throws
// ApiError(isTimeout) when the request outlives `timeoutMs`.
export async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const signal = combineSignals(options.signal, controller);

  try {
    const res = await fetch(url, { ...options, signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    // An abort caused by our timer is a timeout; one caused by the caller's own
    // signal is a deliberate cancel and is passed through untouched so callers
    // that rely on `err.name === 'AbortError'` keep working.
    if (err.name === 'AbortError' && !options.signal?.aborted) {
      throw new ApiError('The server is taking too long to respond. Please try again.', {
        isTimeout: true,
      });
    }
    throw err;
  }
}

// Parses a JSON response and throws the server's own `{ error }` message on a
// non-2xx status, so every caller shows the same human-readable text.
async function readJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data?.error || `Server responded ${res.status} ${res.statusText}`, {
      status: res.status,
      body: data,
    });
  }
  return data;
}

// Throws ApiError on failure (including non-2xx). Use when the caller needs to
// know *why* a request failed.
export async function requestJson(path, { timeoutMs = DEFAULT_TIMEOUT_MS, ...options } = {}) {
  const res = await fetchWithTimeout(`${API_BASE}${path}`, options, timeoutMs);
  return readJson(res);
}

// POSTs JSON and returns the parsed body. Used by the auth paths.
export async function postJson(path, body, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  return requestJson(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeoutMs,
  });
}
