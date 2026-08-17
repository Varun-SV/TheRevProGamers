/**
 * Fetch helpers shared by every integration.
 *
 * Rule for this whole layer: never throw. A missing token, a rate limit or a
 * dead network must degrade to "no data" so the site still builds.
 */

const DEFAULT_TIMEOUT = 15000;
const USER_AGENT = 'therevprogamers-site/1.0 (+https://therevprogamers.com)';

export async function request(url, { timeout = DEFAULT_TIMEOUT, retries = 2, ...init } = {}) {
  let lastErr = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, ...(init.headers || {}) },
      });
      clearTimeout(timer);

      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status}`);
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
          continue;
        }
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
        continue;
      }
    }
  }
  throw lastErr || new Error('request failed');
}

/** GET JSON. Returns { ok, data, error }. */
export async function getJson(url, init = {}) {
  try {
    const res = await request(url, {
      ...init,
      headers: { Accept: 'application/json', ...(init.headers || {}) },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return {
        ok: false,
        data: null,
        error: `HTTP ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 200)}` : ''}`,
      };
    }
    return { ok: true, data: await res.json(), error: null };
  } catch (err) {
    return { ok: false, data: null, error: err.message };
  }
}

/** GET text. Returns { ok, data, error }. */
export async function getText(url, init = {}) {
  try {
    const res = await request(url, init);
    if (!res.ok) return { ok: false, data: null, error: `HTTP ${res.status} ${res.statusText}` };
    return { ok: true, data: await res.text(), error: null };
  } catch (err) {
    return { ok: false, data: null, error: err.message };
  }
}

/** POST JSON. Returns { ok, data, error, status }. */
export async function postJson(url, body, init = {}) {
  try {
    const res = await request(url, {
      method: 'POST',
      retries: 1,
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(init.headers || {}),
      },
      body: JSON.stringify(body),
    });
    const text = await res.text().catch(() => '');
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { ok: res.ok, status: res.status, data, error: res.ok ? null : `HTTP ${res.status} — ${String(text).slice(0, 300)}` };
  } catch (err) {
    return { ok: false, status: 0, data: null, error: err.message };
  }
}
