/**
 * Reads the data that integrations produce.
 *
 * Lookup order per dataset:
 *   1. content/data/generated/<name>.json   written by `npm run fetch` (gitignored)
 *   2. content/data/fallback/<name>.json    committed sample data
 *   3. a built-in empty shape
 *
 * This is what lets a fresh clone with zero secrets still produce a complete,
 * good-looking site.
 */

import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './config.mjs';

export const GENERATED_DIR = path.join(ROOT, 'content/data/generated');
export const FALLBACK_DIR = path.join(ROOT, 'content/data/fallback');

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function loadDataset(name, emptyShape = {}) {
  const generated = readJson(path.join(GENERATED_DIR, `${name}.json`));
  if (generated) return { ...emptyShape, ...generated, _source: 'generated' };

  const fallback = readJson(path.join(FALLBACK_DIR, `${name}.json`));
  if (fallback) return { ...emptyShape, ...fallback, _source: 'fallback' };

  return { ...emptyShape, _source: 'empty' };
}

export function writeDataset(name, payload) {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(GENERATED_DIR, `${name}.json`),
    JSON.stringify({ ...payload, fetchedAt: new Date().toISOString() }, null, 2)
  );
}

export const loadAllData = () => ({
  youtube: loadDataset('youtube', { videos: [], channel: {}, ok: false }),
  patreon: loadDataset('patreon', { tiers: [], patrons: [], ok: false }),
  github: loadDataset('github', { repos: [], totals: {}, ok: false }),
});
