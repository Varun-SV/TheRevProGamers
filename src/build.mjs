#!/usr/bin/env node
/**
 * Static site generator.
 *
 *   node src/build.mjs   ->   dist/
 *
 * Reads Markdown from content/, data from content/data/, and writes a complete
 * static site. The output is deployable to GitHub Pages, Railway, Netlify or
 * any static host — and src/server.mjs can serve the same directory with a
 * live API layer on top.
 */

import fs from 'node:fs';
import path from 'node:path';
import { config, ROOT, enabled } from './lib/config.mjs';
import { loadPosts, loadPages, loadGear, collectTags, slugify, esc } from './lib/content.mjs';
import { loadAllData } from './lib/data.mjs';
import * as T from './lib/templates.mjs';

const DIST = path.join(ROOT, 'dist');
const THEME = path.join(ROOT, 'src/theme');
const PUBLIC = path.join(ROOT, 'public');

/* ── fs helpers ────────────────────────────────────────────────────── */

const writeFile = (rel, contents) => {
  const dest = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, contents);
};

/** Write an HTML page at a pretty URL: "/blog/x/" -> dist/blog/x/index.html */
const writePage = (url, html) => {
  const rel = url === '/' ? 'index.html' : `${url.replace(/^\/|\/$/g, '')}/index.html`;
  writeFile(rel, html);
};

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return 0;
  let count = 0;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) count += copyDir(from, to);
    else {
      fs.copyFileSync(from, to);
      count++;
    }
  }
  return count;
}

/* ── Generated SVG assets ──────────────────────────────────────────── */

function svgPlaceholders() {
  const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#08090d"/>
  <rect x="4.5" y="4.5" width="55" height="55" rx="9" fill="none" stroke="#e8c547" stroke-width="2.5"/>
  <text x="32" y="42" font-family="Georgia,serif" font-size="30" font-weight="900" fill="#e8c547" text-anchor="middle">R</text>
</svg>`;

  const og = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#08090d"/><stop offset="100%" stop-color="#1b2030"/>
    </linearGradient>
    <radialGradient id="glow" cx="85%" cy="12%" r="60%">
      <stop offset="0%" stop-color="#e8c547" stop-opacity="0.26"/>
      <stop offset="100%" stop-color="#e8c547" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect x="70" y="70" width="1060" height="490" fill="none" stroke="#e8c547" stroke-opacity="0.28" stroke-width="2"/>
  <text x="110" y="250" font-family="Georgia,serif" font-size="86" font-weight="900" fill="#f2ece1">${esc(
    config.siteName
  )}</text>
  <text x="112" y="316" font-family="monospace" font-size="26" letter-spacing="6" fill="#e8c547">${esc(
    config.siteTagline.toUpperCase()
  )}</text>
  <line x1="110" y1="360" x2="470" y2="360" stroke="#e85d47" stroke-width="5"/>
  <text x="110" y="500" font-family="monospace" font-size="22" letter-spacing="3" fill="#a8a294">${esc(
    config.siteUrl.replace(/^https?:\/\//, '')
  )}</text>
</svg>`;

  const videoPlaceholder = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
  <rect width="640" height="360" fill="#1b2030"/>
  <circle cx="320" cy="180" r="44" fill="#e85d47" fill-opacity="0.9"/>
  <polygon points="306,157 350,180 306,203" fill="#fff"/>
  <text x="320" y="272" font-family="monospace" font-size="15" letter-spacing="3" fill="#6b6659" text-anchor="middle">THEREVPROGAMERS</text>
</svg>`;

  const gearPlaceholder = (label, glyph) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="none"/>
  <rect x="40" y="60" width="320" height="180" rx="14" fill="#232941" stroke="#e8c547" stroke-opacity="0.35" stroke-width="2"/>
  <text x="200" y="165" font-size="62" text-anchor="middle">${glyph}</text>
  <text x="200" y="212" font-family="monospace" font-size="14" letter-spacing="3" fill="#a8a294" text-anchor="middle">${esc(
    label.toUpperCase()
  )}</text>
</svg>`;

  writeFile('assets/favicon.svg', favicon);
  writeFile('assets/og-default.svg', og);
  writeFile('assets/video-placeholder.svg', videoPlaceholder);

  const gearArt = {
    keyboard: ['Keyboard', '⌨️'],
    mouse: ['Mouse', '🖱️'],
    microphone: ['Microphone', '🎙️'],
    monitor: ['Monitor', '🖥️'],
    headphones: ['Headphones', '🎧'],
    ssd: ['Storage', '💾'],
    placeholder: ['Gear', '📦'],
  };
  for (const [name, [label, glyph]] of Object.entries(gearArt)) {
    writeFile(`assets/gear/${name}.svg`, gearPlaceholder(label, glyph));
  }
}

/* ── Feeds ─────────────────────────────────────────────────────────── */

function buildFeed(posts) {
  const items = posts
    .slice(0, 30)
    .map(
      (p) => `  <item>
    <title>${esc(p.title)}</title>
    <link>${config.siteUrl}${p.url}</link>
    <guid isPermaLink="true">${config.siteUrl}${p.url}</guid>
    <description>${esc(p.description)}</description>
    ${p.date ? `<pubDate>${new Date(p.date).toUTCString()}</pubDate>` : ''}
    ${p.tags.map((t) => `<category>${esc(t)}</category>`).join('')}
  </item>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${esc(config.siteName)}</title>
  <link>${config.siteUrl}</link>
  <description>${esc(config.siteDescription)}</description>
  <language>en</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <atom:link href="${config.siteUrl}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
</channel>
</rss>`;
}

function buildSitemap(urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${config.siteUrl}${u.url}</loc>
    ${u.date ? `<lastmod>${new Date(u.date).toISOString().slice(0, 10)}</lastmod>` : ''}
    <changefreq>${u.freq || 'weekly'}</changefreq>
    <priority>${u.priority || '0.7'}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;
}

/* ── Build ─────────────────────────────────────────────────────────── */

async function build() {
  const started = Date.now();
  console.log(`\n  Building ${config.siteName}`);
  console.log(`  ${config.siteUrl}\n`);

  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  const includeDrafts = process.argv.includes('--drafts') || process.env.INCLUDE_DRAFTS === 'true';
  const posts = loadPosts({ includeDrafts });
  const pages = loadPages();
  const gear = loadGear();
  const data = loadAllData();
  const tags = collectTags(posts);

  const reviews = posts.filter((p) => p.isReview);

  /* Assets */
  copyDir(THEME, path.join(DIST, 'assets'));
  copyDir(PUBLIC, DIST);
  svgPlaceholders();

  /* Home */
  writePage(
    '/',
    T.homePage({
      posts: posts.slice(0, 5),
      videos: data.youtube.videos || [],
      repos: data.github.repos || [],
      gear,
      patreon: data.patreon,
      youtube: data.youtube,
      github: data.github,
    })
  );

  /* Blog index */
  writePage(
    '/blog/',
    T.blogIndexPage(posts, {
      title: 'Blog',
      description: `Every post on ${config.siteName}.`,
      intro: 'Reviews, build guides, project write-ups and the occasional rant. Newest first.',
      url: '/blog/',
    })
  );

  /* Reviews index */
  writePage(
    '/reviews/',
    T.blogIndexPage(reviews, {
      title: 'Reviews',
      description: 'Hardware and software reviews, with the numbers attached.',
      intro: 'Everything I have tested properly. Scores are out of 10 and nothing here is sponsored.',
      url: '/reviews/',
      current: '/reviews/',
    })
  );

  /* Individual posts */
  for (const [i, post] of posts.entries()) {
    const related = gear.filter((g) => post.gear.includes(g.id));
    writePage(
      post.url,
      T.postPage(post, {
        // posts[] is newest-first, so the *next* index is the older post.
        prev: posts[i + 1] || null,
        next: posts[i - 1] || null,
        gear: related,
      })
    );
  }

  /* Tag pages */
  for (const { tag, slug } of tags) {
    const tagged = posts.filter((p) => p.tags.some((t) => slugify(t) === slug));
    writePage(
      `/tags/${slug}/`,
      T.blogIndexPage(tagged, {
        title: `#${tag}`,
        description: `Posts tagged ${tag}.`,
        intro: `Everything filed under “${tag}”.`,
        url: `/tags/${slug}/`,
        current: '/blog/',
      })
    );
  }

  /* Data-driven pages */
  writePage('/videos/', T.videosPage(data.youtube));
  writePage('/projects/', T.projectsPage(data.github));
  writePage('/gear/', T.gearPage(gear));
  writePage('/support/', T.supportPage({ patreon: data.patreon }));
  writePage(
    '/about/',
    T.aboutPage({
      page: pages.find((p) => p.slug === 'about'),
      github: data.github,
      youtube: data.youtube,
    })
  );

  /* Any other content/pages/*.md become their own page */
  for (const page of pages.filter((p) => p.slug !== 'about')) {
    writePage(
      `/${page.slug}/`,
      T.layout(
        { title: page.title, description: page.description, url: `/${page.slug}/` },
        `<section class="hero"><div class="wrap"><h1 class="hero-title">${esc(page.title)}</h1></div></section>
<section class="section"><div class="wrap-text"><div class="prose">${page.html}</div></div></section>`
      )
    );
  }

  /* 404 — GitHub Pages and most static hosts serve /404.html automatically */
  writeFile('404.html', T.notFoundPage());

  /* Feeds and machine-readable files */
  writeFile('feed.xml', buildFeed(posts));
  writeFile(
    'sitemap.xml',
    buildSitemap([
      { url: '/', freq: 'daily', priority: '1.0' },
      { url: '/blog/', freq: 'daily', priority: '0.9' },
      { url: '/reviews/', priority: '0.8' },
      { url: '/projects/', priority: '0.8' },
      { url: '/videos/', priority: '0.7' },
      { url: '/gear/', priority: '0.7' },
      { url: '/support/', priority: '0.6' },
      { url: '/about/', priority: '0.5' },
      ...posts.map((p) => ({ url: p.url, date: p.date, priority: '0.8' })),
      ...tags.map((t) => ({ url: `/tags/${t.slug}/`, priority: '0.4' })),
    ])
  );
  writeFile(
    'robots.txt',
    `User-agent: *\nAllow: /\n\nSitemap: ${config.siteUrl}/sitemap.xml\n`
  );

  /* Search index — powers the ⌘K palette */
  writeFile(
    'search-index.json',
    JSON.stringify([
      ...posts.map((p) => ({
        title: p.title,
        url: p.url,
        description: p.description,
        tags: p.tags,
        date: p.dateDisplay,
        kind: p.isReview ? 'Review' : p.type === 'guide' ? 'Guide' : 'Post',
        body: p.markdown.slice(0, 1200),
      })),
      ...(data.github.repos || []).map((r) => ({
        title: r.name,
        url: r.url,
        description: r.description,
        tags: r.topics || [],
        kind: 'Project',
      })),
      ...gear.map((g) => ({
        title: g.name,
        url: '/gear/',
        description: g.blurb,
        tags: g.tags || [],
        kind: 'Gear',
      })),
      ...[
        { title: 'Blog', url: '/blog/', kind: 'Page' },
        { title: 'Reviews', url: '/reviews/', kind: 'Page' },
        { title: 'Projects', url: '/projects/', kind: 'Page' },
        { title: 'Videos', url: '/videos/', kind: 'Page' },
        { title: 'Gear', url: '/gear/', kind: 'Page' },
        { title: 'Support', url: '/support/', kind: 'Page' },
        { title: 'About', url: '/about/', kind: 'Page' },
      ],
    ])
  );

  /* Custom domain for GitHub Pages */
  const host = config.siteUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (host && !host.endsWith('github.io') && !host.startsWith('localhost')) {
    writeFile('CNAME', `${host}\n`);
  }

  /* Tell static hosts not to run Jekyll over the output */
  writeFile('.nojekyll', '');

  /* Build manifest — handy for the server and for debugging deploys */
  writeFile(
    'build-info.json',
    JSON.stringify(
      {
        builtAt: new Date().toISOString(),
        siteUrl: config.siteUrl,
        counts: {
          posts: posts.length,
          reviews: reviews.length,
          tags: tags.length,
          videos: (data.youtube.videos || []).length,
          repos: (data.github.repos || []).length,
          gear: gear.length,
        },
        dataSources: {
          youtube: data.youtube._source,
          patreon: data.patreon._source,
          github: data.github._source,
        },
        integrationsEnabled: enabled,
      },
      null,
      2
    )
  );

  /* ── Report ─────────────────────────────────────────────────────── */
  const ms = Date.now() - started;
  console.log(`  Posts        ${posts.length}${includeDrafts ? ' (drafts included)' : ''}`);
  console.log(`  Reviews      ${reviews.length}`);
  console.log(`  Tags         ${tags.length}`);
  console.log(`  Videos       ${(data.youtube.videos || []).length} (${data.youtube._source})`);
  console.log(`  Repos        ${(data.github.repos || []).length} (${data.github._source})`);
  console.log(`  Gear         ${gear.length}`);
  console.log(`  Patreon      ${(data.patreon.tiers || []).length} tiers (${data.patreon._source})`);

  const fallbacks = Object.entries({
    youtube: data.youtube._source,
    patreon: data.patreon._source,
    github: data.github._source,
  }).filter(([, src]) => src !== 'generated');

  if (fallbacks.length) {
    console.log(
      `\n  Note: ${fallbacks.map(([k]) => k).join(', ')} used sample data.` +
        `\n  Run "npm run fetch" with the matching secrets set to pull live data.`
    );
  }

  console.log(`\n  Built to dist/ in ${ms}ms\n`);
}

build().catch((err) => {
  console.error('\nBuild failed:', err);
  process.exit(1);
});
