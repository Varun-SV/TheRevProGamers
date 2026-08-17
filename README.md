# TheRevProGamers

The blog, project index, video archive and gear list behind
[@therevprogamers](https://www.youtube.com/@therevprogamers).

Posts are Markdown files. A build script turns them into static HTML. The
video grid, project list and Patreon tiers pull themselves from the YouTube,
GitHub and Patreon APIs. No CMS, no database.

```
content/blog/*.md  ──┐
content/data/*.json ─┼─→  npm run build  ──→  dist/  ──→  GitHub Pages or Railway
APIs (scheduled)   ──┘
```

---

## Quick start

```bash
npm install
npm run dev          # build + serve on http://localhost:3000
```

It runs with **no configuration at all**. Every unset integration falls back to
sample data in `content/data/fallback/`, marked with a "Sample" badge naming
the secret that would replace it.

| Command | What it does |
|---|---|
| `npm run dev` | Rebuild and serve locally with live reload of data |
| `npm run build` | Build the static site into `dist/` |
| `npm run fetch` | Pull live API data into `content/data/generated/` |
| `npm run fetch:build` | Both, in order — what CI runs |
| `npm start` | Serve `dist/` plus the live `/api/*` layer (Railway) |
| `npm run new -- "Title"` | Scaffold a new post with correct front matter |
| `npm run crosspost` | Cross-post the newest post (see below) |

---

## Writing a post

```bash
npm run new -- "The 75% board that ended my keyboard phase" --type review
```

Creates `content/blog/<slug>.md`. Push it to `main` and it's live.

### Front matter

```yaml
---
title: "Post title"
date: 2026-08-14
description: "Shown on cards, in search results and in link previews."
tags: [hardware, keyboards]
type: review          # post | review | guide | project
featured: true        # pin to the top of the homepage
draft: true           # exclude from the build
cover: /assets/covers/thing.jpg
video: https://www.youtube.com/watch?v=...   # adds a "watch it" callout
repo: https://github.com/...                 # adds a "source on GitHub" callout
gear: [main-keyboard]                        # pulls cards from content/data/gear.json
---
```

`type: review` additionally renders a score readout, a pros/cons panel and a
spec table from these fields — you never write that markup by hand:

```yaml
rating: 8.5
verdict: >
  One sentence that sums the whole thing up.
pros:
  - Something that genuinely works
cons:
  - Something that genuinely does not
specs:
  Layout: 75%
  Weight: 1.6 kg
```

Reviews also emit `schema.org/Review` structured data, so the score can appear
in search results.

### Gear and affiliate links

Edit `content/data/gear.json` — it is the single source for `/gear/` and for
any post referencing items by `id`. Set `AMAZON_ASSOCIATE_TAG` and your tag is
appended to every bare `amazon.*` link at build time, so you never paste
tagged URLs by hand. Monetised links get a small badge, and any page carrying
one shows the disclosure automatically.

---

## Configuration

Every value resolves in this order:

1. **Environment variable** (GitHub Secrets/Variables, Railway variables)
2. **`content/data/site.json`** — committed, safe-to-share defaults
3. **Built-in fallback**

Nothing is required. A missing secret disables one integration; it never fails
a build. Copy `.env.example` to `.env` for local work.

### Where each value goes on GitHub

Settings ▸ Secrets and variables ▸ Actions

**Variables** (not sensitive — visible in logs):

| Name | Example |
|---|---|
| `SITE_URL` | `https://therevprogamers.com` |
| `SITE_NAME` | `TheRevProGamers` |
| `SITE_TAGLINE` | `Games, gear, and things I build.` |
| `AUTHOR_NAME` | `Varun SV` |
| `YOUTUBE_HANDLE` | `@therevprogamers` |
| `PATREON_URL` | `https://www.patreon.com/cw/VarunSV` |
| `BMC_URL` / `BMC_USERNAME` | `https://buymeacoffee.com/varunsv` / `varunsv` |
| `GH_USERNAME` | `Varun-SV` |
| `PINNED_REPOS` | `TheRevProGamers,other-repo` |
| `MASTODON_INSTANCE_URL` | `https://mastodon.social` |

**Secrets** (tokens — encrypted, never printed):

| Name | Needed for | How to get it |
|---|---|---|
| `YOUTUBE_CHANNEL_ID` | Video grid | [youtube.com/account_advanced](https://www.youtube.com/account_advanced) — starts `UC…` |
| `YOUTUBE_API_KEY` | View counts, durations, sub count | Cloud Console → enable **YouTube Data API v3** → API key |
| `PATREON_ACCESS_TOKEN` | Patreon tiers + patron count | [Register a client](https://www.patreon.com/portal/registration/register-clients) → copy *Creator's Access Token* |
| `GH_API_TOKEN` | Higher GitHub rate limit | Optional. Public data works unauthenticated |
| `AMAZON_ASSOCIATE_TAG` | Affiliate links | Amazon Associates dashboard |
| `DISCORD_WEBHOOK_URL` | Auto cross-post | Server Settings ▸ Integrations ▸ Webhooks |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Auto cross-post | [@BotFather](https://t.me/botfather) / [@userinfobot](https://t.me/userinfobot) |
| `MASTODON_ACCESS_TOKEN` | Auto cross-post | Preferences ▸ Development ▸ New application (`write:statuses`) |
| `DEVTO_API_KEY` | Auto cross-post | Settings ▸ Extensions ▸ DEV Community API Keys |

> **Two things worth knowing.**
> A GitHub Actions secret **cannot be named with the `GITHUB_` prefix** — it's
> reserved. That's why the GitHub token variable is `GH_API_TOKEN`.
> And a secret is **only available inside a workflow run**. It can never be
> read by a static page in a browser — if a value reaches the browser, it is
> public. That's precisely why the data layer writes JSON at build time
> instead of having the page call APIs directly.

---

## Cross-posting

### The honest constraint

**Neither Patreon nor Buy Me a Coffee lets you create a post via their API.**

- **Patreon API v2** — `campaigns.posts` is a *read* scope. The only write
  scope in the entire API is `w:campaigns.webhook`. Post creation is a
  long-standing, unimplemented feature request; the workaround people actually
  use is a browser extension driving the web UI.
- **Buy Me a Coffee API v1** — three GET collections (supporters,
  subscriptions, extras). No write side at all.

Zapier and Make don't rescue this either: both platforms are *trigger-only*
there, so you can react to a new patron but cannot create a post.

### Why there is no Buy Me a Coffee read integration

There was one, and it was removed. Two reasons, in order:

1. **The token portal is broken.** `developers.buymeacoffee.com` returns a
   400, and BMC's developer surface appears to be migrating to
   `studio.buymeacoffee.com`. No token, no read API.
2. **Webhooks can't replace it.** BMC webhooks work and need no token, but
   they only fire for events *after* you register the endpoint — they cannot
   backfill existing supporters, which is exactly what a supporters wall
   needs. A wall that launches empty is worse than no wall.

So the supporters wall was cut. `BMC_URL` and `BMC_USERNAME` remain because
the support buttons and the cross-post composer link still use them. If BMC's
token portal comes back and you want the wall, the git history for the
"Drop the Buy Me a Coffee read integration" commit has the whole thing.

So publishing is split:

| Platform | How | Why |
|---|---|---|
| Discord, Telegram, Mastodon, Dev.to | **Fully automatic** | They have real write APIs |
| RSS (`/feed.xml`) | **Fully automatic** | Generated every build |
| **Patreon**, **Buy Me a Coffee** | **Paste-ready draft + composer link** | No write API exists |

On every push of a new post, `.github/workflows/crosspost.yml`:

1. posts automatically to each configured write-API platform,
2. renders the post into Patreon's and BMC's preferred formats, and
3. opens a **GitHub issue** containing the ready-to-paste text plus a direct
   link to each composer.

Roughly fifteen seconds of pasting per platform, and the text is already
written. Editor-note HTML comments are stripped before anything is published.

```bash
npm run crosspost -- --post <slug>    # one post
npm run crosspost -- --dry-run        # render everything, send nothing
npm run crosspost -- --all            # every post (careful)
```

**Why not browser automation?** Driving Patreon's UI with Playwright means
storing the password to a money-handling account in CI, and it breaks the
first time a button moves. Fifteen honest seconds beats that.

---

## Deploying

### GitHub Pages (free, recommended)

Settings ▸ Pages ▸ Source = **GitHub Actions**. Push to `main` and
`deploy.yml` builds and publishes. `dist/CNAME` is generated from `SITE_URL`,
so a custom domain needs only the DNS records.

`refresh-data.yml` re-runs the deploy on a schedule so subscriber counts, star
counts and patron counts stay current without a content change.

### Railway

`railway.toml` is already configured. Point Railway at the repo, add the same
variables, and it runs `npm ci && npm run fetch && npm run build`, then
`npm start`.

Running a server additionally enables **`/api/*`**, which serves live data
with a 10-minute cache. The page hydrates its counters from `/api/stats` when
a server is present and silently keeps build-time values when it isn't — so
the same `dist/` works on both.

---

## Should this repo be public or private?

**Public**, with three safeguards:

1. **Generated API data is gitignored.** `content/data/generated/` never
   enters git history — CI regenerates it inside each build.
2. **Secrets are safe.** They're encrypted, and GitHub deliberately does not
   pass them to workflows triggered by forked pull requests.
3. **Drafts are the one real leak.** A `draft: true` post isn't rendered, but
   anyone can read the Markdown in the repo. Keep genuinely sensitive drafts
   in a private repo or an unpushed branch.

Public also gets you free GitHub Pages — private repos need a paid plan for
Pages. Go private only if unpublished drafts in the repo are a dealbreaker;
Railway serves private repos fine.

---

## Project layout

```
content/
  blog/*.md              posts — the only files you edit regularly
  pages/about.md         standalone pages
  data/site.json         branding and nav defaults
  data/gear.json         affiliate / gear list
  data/fallback/*.json   sample data used when a secret is unset
  data/generated/*.json  live API data (gitignored)
src/
  build.mjs              the static site generator
  server.mjs             Express server for Railway + /api/*
  lib/                   config, markdown, front matter, templates, icons
  integrations/          youtube, patreon, buymeacoffee, github
  theme/                 site.css, site.js — copied to dist/assets/
scripts/
  fetch-data.mjs         pull live API data
  crosspost.mjs          publish to other platforms
  new-post.mjs           scaffold a post
```

## Licence

MIT — see [LICENSE](LICENSE). Take whatever's useful.
