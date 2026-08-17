#!/usr/bin/env node
/**
 * Express server — the Railway (or any Node host) deployment target.
 *
 *   npm start        serve dist/ with the live API layer
 *   npm run dev      same, but rebuilds on start and disables caching
 *
 * The site is perfectly happy as pure static files, so this is strictly
 * additive. What running a server buys you:
 *
 *   · /api/* returns live video/repo/patron data without a rebuild, so
 *     a new patron shows up in minutes rather than at the next scheduled
 *     build. The client hydrates [data-live] elements from /api/stats and
 *     silently keeps the build-time numbers if there is no server.
 *   · Secrets live in Railway variables and never touch the built output.
 *
 * On static hosting /api/* simply 404s and nothing breaks.
 */

import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { config, enabled, ROOT } from './lib/config.mjs';
import { fetchYouTube } from './integrations/youtube.mjs';
import { fetchPatreon } from './integrations/patreon.mjs';
import { fetchGitHub } from './integrations/github.mjs';
import { loadAllData } from './lib/data.mjs';

const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 3000;
const DEV = process.argv.includes('--dev');

/* Build if the output is missing, so `npm start` works on a cold container. */
if (!fs.existsSync(path.join(DIST, 'index.html')) || DEV) {
  console.log('Building site…');
  execFileSync(process.execPath, [path.join(ROOT, 'src/build.mjs')], { stdio: 'inherit' });
}

const app = express();
app.disable('x-powered-by');

/* ── Tiny in-memory cache ──────────────────────────────────────────── */

const TTL = Number(process.env.API_CACHE_SECONDS || 600) * 1000;
const cache = new Map();

async function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;

  try {
    const value = await fn();
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (err) {
    // Serve stale data rather than an error if we have any.
    if (hit) return hit.value;
    return { ok: false, error: err.message };
  }
}

/* ── API ───────────────────────────────────────────────────────────── */

const api = express.Router();

api.get('/health', (_req, res) =>
  res.json({
    ok: true,
    site: config.siteName,
    uptime: Math.round(process.uptime()),
    integrations: enabled,
  })
);

api.get('/youtube', async (_req, res) => res.json(await cached('youtube', () => fetchYouTube({ limit: 12 }))));
api.get('/github', async (_req, res) => res.json(await cached('github', () => fetchGitHub({ limit: 24 }))));
api.get('/patreon', async (_req, res) => res.json(await cached('patreon', () => fetchPatreon())));

/** Aggregated counters — this is what the client hydrates [data-live] from. */
api.get('/stats', async (_req, res) => {
  const [youtube, github, patreon] = await Promise.all([
    cached('youtube', () => fetchYouTube({ limit: 1 })),
    cached('github', () => fetchGitHub({ limit: 100 })),
    cached('patreon', () => fetchPatreon()),
  ]);

  // Fall back to whatever the build baked in when an integration is unset.
  const built = loadAllData();

  res.json({
    youtube: {
      subscribers: youtube.channel?.subscribersDisplay || built.youtube.channel?.subscribersDisplay || '',
      videos: youtube.channel?.videoCount ?? null,
    },
    github: {
      stars: github.totals?.stars ?? built.github.totals?.stars ?? null,
      repos: github.totals?.repos ?? null,
    },
    patreon: { patrons: patreon.patronCount ?? null },
    generatedAt: new Date().toISOString(),
  });
});

app.use('/api', api);

/* ── Static site ───────────────────────────────────────────────────── */

app.use(
  express.static(DIST, {
    extensions: ['html'],
    maxAge: DEV ? 0 : '1h',
    setHeaders(res, filePath) {
      // Hashless asset names, so keep HTML fresh and let assets cache briefly.
      if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
      if (/\.(svg|css|js)$/.test(filePath) && !DEV) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
      }
    },
  })
);

/* Pretty URLs: /blog/foo -> dist/blog/foo/index.html */
app.get(/.*/, (req, res, next) => {
  const candidate = path.join(DIST, req.path, 'index.html');
  if (candidate.startsWith(DIST) && fs.existsSync(candidate)) return res.sendFile(candidate);
  next();
});

/* 404 */
app.use((_req, res) => {
  const notFound = path.join(DIST, '404.html');
  if (fs.existsSync(notFound)) return res.status(404).sendFile(notFound);
  res.status(404).type('txt').send('Not found');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  ${config.siteName} serving on http://localhost:${PORT}`);
  console.log(`  API:  http://localhost:${PORT}/api/health`);
  const live = Object.entries(enabled).filter(([, v]) => v).map(([k]) => k);
  console.log(`  Live integrations: ${live.length ? live.join(', ') : 'none configured (using build-time data)'}\n`);
});
