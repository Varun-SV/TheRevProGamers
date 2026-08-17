---
title: "I rebuilt my blog as a folder of Markdown files"
date: 2026-08-11
description: "No CMS, no database, no admin panel. Just Markdown, a build script, and four APIs that keep the numbers honest. Here's the architecture and the two things that didn't work."
tags: [projects, javascript, static-sites, github]
type: project
repo: https://github.com/Varun-SV/TheRevProGamers
author: Varun SV
---

The version of this site before this one fetched its posts from the GitHub API *in the reader's browser*. Every visitor's browser hit `api.github.com` directly, once per post, to fetch a `meta.json` and a `content.md`, then rendered the Markdown client-side.

It worked. It was also, on reflection, three separate bad ideas stacked on top of each other, and fixing them turned into a genuinely interesting rewrite.

## Why the client-side approach had to go

**GitHub's unauthenticated API allows 60 requests per hour, per IP.** Two files per post means a ten-post blog spends twenty requests on a single page load. Three readers behind the same office NAT and everyone gets rate-limited into an error state. There is no way to raise this limit from a static page, because doing so requires a token, and a token in a static page is a token you have published.

**Google saw an empty page.** The HTML that arrived contained a loading spinner. All the actual content appeared later, via JavaScript, from a third-party domain. Search engines are better at this than they used to be, but "better" is not "good", and link previews on Discord, WhatsApp and X were reliably blank.

**Every reader paid for the same work.** Markdown parsing and syntax highlighting shipped as two CDN libraries and ran again in every single browser, to produce byte-identical output every time. That's work that should happen once, at build time.

The fix for all three is the same fix: **do it before anyone asks.**

## The architecture now

```text
content/blog/*.md      →  build script  →  dist/blog/<slug>/index.html
content/data/*.json    ↗                ↘  feed.xml, sitemap.xml, search-index.json
APIs (scheduled)      ↗
```

A Node script reads the Markdown, renders it, and writes real HTML files. That's the whole thing. The output is a directory of static files that any host will serve.

The build has no framework. It's roughly 400 lines across a handful of modules, and the only runtime dependencies are `marked` for Markdown and `highlight.js` for code blocks — both of which now run *once*, on my machine or in CI, instead of in every reader's browser.

### Front matter drives everything

Each post starts with a small block of metadata:

```yaml
---
title: "I rebuilt my blog as a folder of Markdown files"
date: 2026-08-11
tags: [projects, javascript, static-sites]
type: project
repo: https://github.com/Varun-SV/TheRevProGamers
---
```

`type` is the one that does real work. A post typed `review` gets the score readout, the pros-and-cons panel and the specs table rendered automatically from its front matter, and it gets listed on `/reviews/` as well as `/blog/`. I never write that markup by hand.

### The data layer is where it gets interesting

Four integrations — YouTube, GitHub, Patreon and Buy Me a Coffee — run on a schedule in CI, with their tokens held as encrypted repository secrets. They write JSON into a directory the build reads.

The important detail is the fallback chain:

```js
// 1. live data fetched by CI    2. committed sample data    3. an empty shape
export function loadDataset(name, emptyShape = {}) {
  const generated = readJson(path.join(GENERATED_DIR, `${name}.json`));
  if (generated) return { ...emptyShape, ...generated, _source: 'generated' };

  const fallback = readJson(path.join(FALLBACK_DIR, `${name}.json`));
  if (fallback) return { ...emptyShape, ...fallback, _source: 'fallback' };

  return { ...emptyShape, _source: 'empty' };
}
```

This is the piece I'd recommend stealing regardless of what you're building. It means **a missing token is never a build failure.** Clone the repo with no secrets configured at all and you still get a complete site — the supporter wall shows sample tiers, the video grid shows placeholders, and each one carries a small "Sample" badge naming the secret that would replace it. A broken Patreon token degrades one section instead of taking down a deploy at midnight.

## The two things that didn't work

### Patreon and Buy Me a Coffee can't be posted to

The original goal was: push a post to Git, and it appears on Patreon and Buy Me a Coffee automatically. This is not possible, and I want to save you the afternoon I spent discovering it.

**Patreon's API v2 is read-only for posts.** The `campaigns.posts` scope grants read access. The only write scope in the entire API is `w:campaigns.webhook`. Creating a post is a long-standing feature request that has not been built — which is why the workaround people actually use is a *Chrome extension* that drives the web UI.

**Buy Me a Coffee's API is three GET endpoints:** supporters, subscriptions, extras. There is no write side at all.

Zapier doesn't rescue you either — both platforms are trigger-only there, so you can react to a new patron but you cannot create a post.

So the honest version is semi-automatic. On publish, CI generates the post in each platform's flavour of formatting and opens a GitHub issue containing the ready-to-paste text and a direct link to each platform's composer. Pasting takes about fifteen seconds per platform. Everything that *does* have a write API — Discord, Telegram, Mastodon, Dev.to — is genuinely automatic.

I'd rather have fifteen honest seconds than a browser-automation script that stores my Patreon password in CI and breaks the first time they move a button.

### Secrets can't reach a static page

This one is obvious in hindsight and catches everyone once. A GitHub Actions secret exists only inside a workflow run. It cannot be read by a static page, ever, no matter how you reference it — if the value reaches the browser, it is public.

The consequence is that anything requiring a token has to happen at build time, with the *output* being what ships. Which is why the data layer above writes JSON files rather than the page calling APIs directly.

## What I'd do differently

Nothing about the static approach — it's strictly better than what it replaced. But I'd design the fallback chain first rather than bolting it on after the third failed deploy. Building the "no credentials" path last means every integration gets written twice.

The source is [on GitHub](https://github.com/Varun-SV/TheRevProGamers) if you want to pull it apart. It's MIT licensed; take whatever's useful.
