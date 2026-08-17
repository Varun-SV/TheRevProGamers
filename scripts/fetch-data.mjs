#!/usr/bin/env node
/**
 * Pulls live data from every configured integration into
 * content/data/generated/*.json, which the build then reads.
 *
 * Safe to run with no secrets at all: each integration that lacks credentials
 * is skipped with a note and the build falls back to committed sample data.
 *
 *   npm run fetch
 */

import { config, enabled } from '../src/lib/config.mjs';
import { writeDataset } from '../src/lib/data.mjs';
import { fetchYouTube } from '../src/integrations/youtube.mjs';
import { fetchPatreon } from '../src/integrations/patreon.mjs';
import { fetchBuyMeACoffee } from '../src/integrations/buymeacoffee.mjs';
import { fetchGitHub } from '../src/integrations/github.mjs';

const PINNED_REPOS = (process.env.PINNED_REPOS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Only a *successful* fetch is written to disk.
 *
 * Writing a failed result would shadow the committed fallback data (generated
 * wins over fallback in loadDataset), so one flaky API call would blank a whole
 * section of the site — and any previously-good generated data would be lost
 * too. On failure we leave whatever is already there and let the build fall
 * back on its own.
 */
async function run(name, label, fn) {
  process.stdout.write(`→ ${label}… `);
  try {
    const result = await fn();
    if (result.ok) {
      writeDataset(name, result);
      console.log('ok');
      return true;
    }
    console.log(`skipped (${result.error || 'not configured'}) — keeping existing data`);
    return false;
  } catch (err) {
    console.log(`failed (${err.message}) — keeping existing data`);
    return false;
  }
}

async function main() {
  console.log(`\nFetching integration data for ${config.siteName}\n`);

  const results = await Promise.all([
    run('youtube', 'YouTube', () => fetchYouTube({ limit: 12 })),
    run('github', 'GitHub projects', () => fetchGitHub({ limit: 24, pinned: PINNED_REPOS })),
    run('patreon', 'Patreon', () => fetchPatreon()),
    run('bmc', 'Buy Me a Coffee', () => fetchBuyMeACoffee()),
  ]);

  const okCount = results.filter(Boolean).length;
  console.log(`\n${okCount}/4 integrations returned live data.`);

  if (!enabled.patreon || !enabled.bmc) {
    console.log('\nTip: unset integrations fall back to content/data/fallback/*.json.');
    console.log('     See README.md for the secret names each one needs.\n');
  }
}

main().catch((err) => {
  console.error(err);
  // A data-fetch failure must never fail the deploy — the build uses fallbacks.
  process.exit(0);
});
