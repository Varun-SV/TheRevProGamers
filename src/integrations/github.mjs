/**
 * GitHub projects integration.
 *
 * Works with no credentials at all (60 req/hr unauthenticated is plenty for a
 * scheduled build). Supplying GH_API_TOKEN raises the limit to 5000/hr.
 *
 * Secrets used: GH_USERNAME, GH_API_TOKEN (optional)
 *
 * Note: a GitHub Actions secret may not be named with the `GITHUB_` prefix —
 * that namespace is reserved — hence GH_API_TOKEN. Inside a workflow you can
 * also just pass the built-in ${{ secrets.GITHUB_TOKEN }} into GH_API_TOKEN.
 */

import { config } from '../lib/config.mjs';
import { getJson } from '../lib/http.mjs';

const API = 'https://api.github.com';

function headers() {
  const h = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (config.githubToken) h.Authorization = `Bearer ${config.githubToken}`;
  return h;
}

/** Repos the site should never surface. */
function isHidden(repo, pinned) {
  if (pinned.includes(repo.name.toLowerCase())) return false;
  return (
    repo.private ||
    repo.archived ||
    repo.disabled ||
    repo.fork ||
    repo.name.toLowerCase() === config.githubUsername.toLowerCase() // profile README repo
  );
}

export async function fetchGitHub({ limit = 24, pinned = [] } = {}) {
  const empty = {
    ok: false,
    configured: Boolean(config.githubUsername),
    username: config.githubUsername,
    profileUrl: `https://github.com/${config.githubUsername}`,
    user: null,
    repos: [],
    totals: { repos: 0, stars: 0, forks: 0 },
    error: '',
  };

  if (!config.githubUsername) return { ...empty, error: 'GH_USERNAME not set.' };

  const pinnedLower = pinned.map((p) => String(p).toLowerCase());

  const userUrl = `${API}/users/${config.githubUsername}`;
  const repoUrl = `${API}/users/${config.githubUsername}/repos?per_page=100&sort=updated&type=owner`;

  let [userRes, repoRes] = await Promise.all([
    getJson(userUrl, { headers: headers() }),
    getJson(repoUrl, { headers: headers() }),
  ]);

  // A stale or wrongly-scoped token is worse than no token here: this data is
  // all public, so fall back to an unauthenticated read rather than failing.
  if (config.githubToken && /HTTP 401/.test(repoRes.error || '')) {
    console.warn('  ! GitHub token rejected (401); retrying unauthenticated');
    const anon = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    [userRes, repoRes] = await Promise.all([
      getJson(userUrl, { headers: anon }),
      getJson(repoUrl, { headers: anon }),
    ]);
  }

  if (!repoRes.ok) return { ...empty, error: repoRes.error };

  const all = Array.isArray(repoRes.data) ? repoRes.data : [];
  const visible = all.filter((r) => !isHidden(r, pinnedLower));

  const repos = visible
    .map((r) => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      description: r.description || '',
      url: r.html_url,
      homepage: r.homepage || '',
      language: r.language || '',
      stars: r.stargazers_count || 0,
      forks: r.forks_count || 0,
      topics: Array.isArray(r.topics) ? r.topics.slice(0, 6) : [],
      updatedAt: r.pushed_at || r.updated_at || '',
      createdAt: r.created_at || '',
      isPinned: pinnedLower.includes(r.name.toLowerCase()),
      license: r.license?.spdx_id && r.license.spdx_id !== 'NOASSERTION' ? r.license.spdx_id : '',
    }))
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return b.stars - a.stars || String(b.updatedAt).localeCompare(String(a.updatedAt));
    })
    .slice(0, limit);

  return {
    ok: true,
    configured: true,
    username: config.githubUsername,
    profileUrl: `https://github.com/${config.githubUsername}`,
    user: userRes.ok
      ? {
          name: userRes.data.name || config.githubUsername,
          bio: userRes.data.bio || '',
          avatar: userRes.data.avatar_url || '',
          followers: userRes.data.followers || 0,
          publicRepos: userRes.data.public_repos || 0,
        }
      : null,
    repos,
    totals: {
      repos: visible.length,
      stars: visible.reduce((s, r) => s + (r.stargazers_count || 0), 0),
      forks: visible.reduce((s, r) => s + (r.forks_count || 0), 0),
    },
    error: userRes.ok ? '' : userRes.error,
  };
}

export default fetchGitHub;
