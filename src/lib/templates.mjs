/**
 * Every page in the site is produced by a function in here.
 * Templates are plain template literals — no template engine, no JSX, no build
 * step beyond `node src/build.mjs`.
 */

import { config, nav, enabled } from './config.mjs';
import { esc, formatDate, slugify } from './content.mjs';
import { icons, brandIcons } from './icons.mjs';

const initials = (name) =>
  name.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'TR';

/* ── Shared chrome ─────────────────────────────────────────────────── */

function head({ title, description, url, image, type = 'website', published, tags = [], noindex }) {
  const fullTitle = title === config.siteName ? title : `${title} · ${config.siteName}`;
  const canonical = `${config.siteUrl}${url}`;
  const ogImage = image
    ? image.startsWith('http') ? image : `${config.siteUrl}${image}`
    : `${config.siteUrl}/assets/og-default.svg`;

  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
${noindex ? '<meta name="robots" content="noindex">' : ''}

<meta property="og:type" content="${esc(type)}">
<meta property="og:site_name" content="${esc(config.siteName)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(ogImage)}">
${config.twitterHandle ? `<meta name="twitter:creator" content="${esc(config.twitterHandle)}">` : ''}
${published ? `<meta property="article:published_time" content="${esc(published)}">` : ''}
${tags.map((t) => `<meta property="article:tag" content="${esc(t)}">`).join('\n')}

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;0,900;1,700;1,900&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/site.css">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${esc(config.siteName)}" href="/feed.xml">

<script>
  /* Set the theme before first paint so there is no flash of the wrong theme. */
  (function () {
    try {
      var t = localStorage.getItem('trpg-theme');
      if (!t) t = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', t);
    } catch (e) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  })();
</script>`;
}

function masthead(current) {
  return `<header class="masthead">
  <div class="wrap masthead-top">
    <a class="brand" href="/">
      <span class="brand-mark">${esc(initials(config.siteName))}</span>
      <span class="brand-text">
        <span class="brand-name">${esc(config.siteName)}</span>
        <span class="brand-tag">${esc(config.siteTagline)}</span>
      </span>
    </a>

    <div class="masthead-actions">
      <button id="searchTrigger" class="search-trigger" type="button" aria-label="Search the site">
        ${icons.search}<span>Search…</span><kbd>/</kbd>
      </button>
      <button id="themeToggle" class="icon-btn" type="button" aria-label="Toggle theme">
        <span id="iconSun">${icons.sun}</span><span id="iconMoon">${icons.moon}</span>
      </button>
      <button id="navToggle" class="icon-btn nav-toggle" type="button" aria-label="Toggle navigation" aria-expanded="false" aria-controls="siteNav">
        ${icons.menu}
      </button>
    </div>
  </div>

  <nav class="masthead-nav" id="siteNav" aria-label="Main">
    <div class="wrap">
      <ul class="nav-list">
        ${nav
          .map(
            (item) =>
              `<li><a class="nav-link" href="${esc(item.href)}"${
                item.href === current ? ' aria-current="page"' : ''
              }>${esc(item.label)}</a></li>`
          )
          .join('\n        ')}
      </ul>
    </div>
  </nav>
</header>`;
}

function ticker(stats) {
  const items = stats.filter((s) => s.value !== null && s.value !== undefined && s.value !== '');
  if (!items.length) return '';
  return `<div class="ticker">
  <div class="wrap ticker-inner">
    <span class="ticker-item"><span class="ticker-dot"></span> Live</span>
    ${items
      .map(
        (s) =>
          `<span class="ticker-item">${esc(s.label)} <b${
            s.live ? ` data-live="${esc(s.live)}"` : ''
          }>${esc(String(s.value))}</b></span>`
      )
      .join('\n    ')}
  </div>
</div>`;
}

function footer() {
  const socials = [
    { href: `https://www.youtube.com/${config.youtubeHandle}`, label: 'YouTube', icon: brandIcons.youtube },
    { href: `https://github.com/${config.githubUsername}`, label: 'GitHub', icon: brandIcons.github },
    { href: config.patreonUrl, label: 'Patreon', icon: brandIcons.patreon },
    { href: config.bmcUrl, label: 'Buy Me a Coffee', icon: brandIcons.bmc },
    config.contactEmail && { href: `mailto:${config.contactEmail}`, label: 'Email', icon: brandIcons.mail },
  ].filter(Boolean);

  return `<footer class="site-footer">
  <div class="wrap">
    <div class="footer-grid">
      <div>
        <div class="footer-brand-name">${esc(config.siteName)}</div>
        <p class="footer-bio">${esc(config.authorBio)}</p>
      </div>
      <div class="footer-col">
        <h4>Read</h4>
        <ul>
          <li><a href="/blog/">All posts</a></li>
          <li><a href="/reviews/">Reviews</a></li>
          <li><a href="/projects/">Projects</a></li>
          <li><a href="/gear/">Gear</a></li>
          <li><a href="/feed.xml">RSS feed</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Elsewhere</h4>
        <ul>
          <li><a href="https://www.youtube.com/${esc(config.youtubeHandle)}" target="_blank" rel="noopener">YouTube</a></li>
          <li><a href="https://github.com/${esc(config.githubUsername)}" target="_blank" rel="noopener">GitHub</a></li>
          <li><a href="${esc(config.patreonUrl)}" target="_blank" rel="noopener">Patreon</a></li>
          <li><a href="${esc(config.bmcUrl)}" target="_blank" rel="noopener">Buy Me a Coffee</a></li>
        </ul>
      </div>
    </div>

    <div class="footer-bottom">
      <span>© ${new Date().getFullYear()} ${esc(config.authorName)}</span>
      <div class="footer-social">
        ${socials
          .map(
            (s) =>
              `<a href="${esc(s.href)}" target="_blank" rel="noopener" aria-label="${esc(s.label)}">${s.icon}</a>`
          )
          .join('\n        ')}
      </div>
    </div>
  </div>
</footer>`;
}

const searchOverlay = `<div class="cmd-overlay" id="cmdOverlay" role="dialog" aria-modal="true" aria-label="Search" aria-hidden="true">
  <div class="cmd-box">
    <div class="cmd-input-row">
      ${icons.search}
      <input id="cmdInput" class="cmd-input" type="search" placeholder="Search posts, reviews, projects…" autocomplete="off" spellcheck="false">
    </div>
    <div class="cmd-results" id="cmdResults"></div>
    <div class="cmd-foot"><span>↑↓ Navigate</span><span>⏎ Open</span><span>Esc Close</span></div>
  </div>
</div>`;

/** The page shell every template renders into. */
export function layout(meta, body, { stats = [], current = '' } = {}) {
  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
${head(meta)}
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<div class="progress" id="progress"></div>
${masthead(current)}
${ticker(stats)}
<main class="site-main" id="main">
${body}
</main>
${footer()}
${searchOverlay}
<button class="to-top" id="toTop" type="button" aria-label="Back to top">${icons.arrowUp}</button>
<script src="/assets/site.js" defer></script>
${meta.jsonLd ? `<script type="application/ld+json">${JSON.stringify(meta.jsonLd)}</script>` : ''}
</body>
</html>`;
}

/* ── Reusable fragments ────────────────────────────────────────────── */

const sampleBadge = (dataset, secretName) =>
  dataset?.sample
    ? `<span class="badge badge-sample" title="Set ${secretName} to replace this with live data">Sample</span>`
    : '';

function postCard(post, { featured = false } = {}) {
  const badge = post.isReview
    ? '<span class="badge badge-review">Review</span>'
    : post.type === 'guide'
      ? '<span class="badge badge-guide">Guide</span>'
      : post.type === 'project'
        ? '<span class="badge badge-project">Project</span>'
        : '';

  return `<article class="card reveal${featured ? ' card-featured' : ''}">
  ${
    post.cover
      ? `<a class="card-media" href="${esc(post.url)}" tabindex="-1" aria-hidden="true"><img src="${esc(post.cover)}" alt="" loading="lazy" decoding="async"></a>`
      : ''
  }
  <div class="card-body">
    <div class="card-meta">
      ${badge}
      ${post.dateDisplay ? `<span>${esc(post.dateDisplay)}</span>` : ''}
      <span class="sep">·</span>
      <span>${post.readingTime} min</span>
      ${post.rating != null ? `<span class="score"><span class="score-value">${post.rating}</span><span class="score-max">/10</span></span>` : ''}
    </div>
    <h3 class="card-title"><a href="${esc(post.url)}">${esc(post.title)}</a></h3>
    <p class="card-desc">${esc(post.description)}</p>
    ${
      post.tags.length
        ? `<div class="tag-list">${post.tags
            .slice(0, 3)
            .map((t) => `<a class="tag" href="/tags/${slugify(t)}/">${esc(t)}</a>`)
            .join('')}</div>`
        : ''
    }
  </div>
</article>`;
}

function videoCard(video) {
  const href = video.url || `https://www.youtube.com/${config.youtubeHandle}`;
  return `<article class="card reveal">
  <a class="card-media video-thumb" href="${esc(href)}" target="_blank" rel="noopener">
    <img src="${esc(video.thumbnail || '/assets/video-placeholder.svg')}" alt="" loading="lazy" decoding="async"
         onerror="this.onerror=null;this.src='/assets/video-placeholder.svg'">
    <span class="video-play"><span>${icons.play}</span></span>
    ${video.duration ? `<span class="video-duration">${esc(video.duration)}</span>` : ''}
  </a>
  <div class="card-body">
    <div class="card-meta">
      ${video.publishedAt ? `<span>${esc(formatDate(video.publishedAt))}</span>` : ''}
      ${video.viewsDisplay ? `<span class="sep">·</span><span>${esc(video.viewsDisplay)} views</span>` : ''}
    </div>
    <h3 class="card-title"><a href="${esc(href)}" target="_blank" rel="noopener">${esc(video.title)}</a></h3>
    ${video.description ? `<p class="card-desc">${esc(video.description.slice(0, 130))}${video.description.length > 130 ? '…' : ''}</p>` : ''}
  </div>
</article>`;
}

function repoCard(repo) {
  return `<article class="card reveal">
  <div class="card-body repo-card">
    <div class="card-meta">
      ${repo.isPinned ? '<span class="badge badge-project">Pinned</span>' : ''}
      ${repo.license ? `<span>${esc(repo.license)}</span>` : ''}
    </div>
    <h3 class="repo-name"><a href="${esc(repo.url)}" target="_blank" rel="noopener">${esc(repo.name)}</a></h3>
    <p class="card-desc">${esc(repo.description || 'No description yet.')}</p>
    ${
      repo.topics?.length
        ? `<div class="tag-list">${repo.topics.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>`
        : ''
    }
    <div class="card-foot">
      <div class="repo-stats">
        ${repo.language ? `<span><i class="lang-dot"></i>${esc(repo.language)}</span>` : ''}
        <span>${icons.star}${repo.stars}</span>
        <span>${icons.fork}${repo.forks}</span>
      </div>
      ${repo.homepage ? `<a class="tag" href="${esc(repo.homepage)}" target="_blank" rel="noopener">Live</a>` : ''}
    </div>
  </div>
</article>`;
}

function gearCard(item) {
  return `<article class="card reveal">
  <div class="gear-media">
    <img src="${esc(item.image || '/assets/gear/placeholder.svg')}" alt="${esc(item.name)}" loading="lazy" decoding="async"
         onerror="this.onerror=null;this.src='/assets/gear/placeholder.svg'">
  </div>
  <div class="card-body">
    <div class="card-meta">
      ${item.category ? `<span>${esc(item.category)}</span>` : ''}
      ${item.rating ? `<span class="score"><span class="score-value">${item.rating}</span><span class="score-max">/10</span></span>` : ''}
    </div>
    <h3 class="card-title">${esc(item.name)}</h3>
    <p class="card-desc">${esc(item.blurb || '')}</p>
    ${item.why ? `<p class="gear-why">${esc(item.why)}</p>` : ''}
    <div class="card-foot">
      <span class="gear-price">${esc(item.price || '')}</span>
      ${
        item.url
          ? `<a class="btn" href="${esc(item.url)}" target="_blank" rel="noopener sponsored">Check price ${icons.external}</a>`
          : ''
      }
    </div>
  </div>
</article>`;
}

const disclosure = () =>
  `<div class="callout callout-disclosure">${icons.heart}<span>${esc(config.affiliateDisclosure)}</span></div>`;

function emptyState(title, body) {
  return `<div class="empty"><h3>${title}</h3><p>${body}</p></div>`;
}

/* ── Pages ─────────────────────────────────────────────────────────── */

export function homePage({ posts, videos, repos, gear, patreon, youtube, github }) {
  const featured = posts.find((p) => p.featured) || posts[0];
  const rest = posts.filter((p) => p !== featured).slice(0, 4);

  const stats = [
    youtube?.channel?.subscribersDisplay && {
      label: 'Subscribers', value: youtube.channel.subscribersDisplay, live: 'youtube.subscribers',
    },
    { label: 'Posts', value: posts.length },
    github?.totals?.stars ? { label: 'Stars', value: github.totals.stars, live: 'github.stars' } : null,
    patreon?.patronCount ? { label: 'Patrons', value: patreon.patronCount, live: 'patreon.patrons' } : null,
  ].filter(Boolean);

  const body = `
<section class="hero">
  <div class="wrap hero-grid">
    <div>
      <div class="eyebrow">${esc(config.youtubeHandle)} — Est. ${new Date().getFullYear()}</div>
      <h1 class="hero-title">Built, broken,<br><em>written down</em></h1>
      <p class="hero-lede">${esc(config.siteDescription)} Everything here is <strong>tested first, written second</strong> — reviews with the numbers attached, projects with the source, and guides I actually follow myself.</p>
      <div class="hero-cta">
        <a class="btn btn-primary" href="/blog/">Read the blog ${icons.arrowRight}</a>
        <a class="btn" href="https://www.youtube.com/${esc(config.youtubeHandle)}" target="_blank" rel="noopener">${brandIcons.youtube} YouTube</a>
        <a class="btn" href="/support/">${icons.heart} Support</a>
      </div>
    </div>
    <div class="hero-deco" aria-hidden="true">${esc(initials(config.siteName))}</div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="section-head">
      <h2 class="section-title">Latest writing</h2>
      <a class="section-more" href="/blog/">All posts</a>
    </div>
    ${
      posts.length
        ? `<div class="grid grid-2">
      ${featured ? postCard(featured, { featured: true }) : ''}
      ${rest.map((p) => postCard(p)).join('\n      ')}
    </div>`
        : emptyState('No posts yet', 'Add a Markdown file to <code>content/blog/</code> and it appears here on the next build.')
    }
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="section-head">
      <h2 class="section-title">From the channel ${sampleBadge(youtube, 'YOUTUBE_CHANNEL_ID')}</h2>
      <a class="section-more" href="/videos/">All videos</a>
    </div>
    ${
      videos.length
        ? `<div class="grid grid-3">${videos.slice(0, 3).map(videoCard).join('\n      ')}</div>`
        : emptyState('No videos loaded', 'Set <code>YOUTUBE_CHANNEL_ID</code> in your repository secrets to pull the channel feed.')
    }
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="section-head">
      <h2 class="section-title">Things I've built ${sampleBadge(github, 'GH_USERNAME')}</h2>
      <a class="section-more" href="/projects/">All projects</a>
    </div>
    ${
      repos.length
        ? `<div class="grid grid-3">${repos.slice(0, 3).map(repoCard).join('\n      ')}</div>`
        : emptyState('No repositories loaded', 'Set <code>GH_USERNAME</code> to list your public repositories here.')
    }
  </div>
</section>

${
  gear.length
    ? `<section class="section">
  <div class="wrap">
    <div class="section-head">
      <h2 class="section-title">Gear I actually use</h2>
      <a class="section-more" href="/gear/">Full list</a>
    </div>
    <div class="grid grid-4">${gear.filter((g) => g.featured).slice(0, 4).map(gearCard).join('\n      ')}</div>
  </div>
</section>`
    : ''
}

<section class="section">
  <div class="wrap">
    <div class="section-head"><h2 class="section-title">Keep this going</h2></div>
    <div class="support-split">
      <div class="platform-card">
        <h3>${brandIcons.patreon} Patreon</h3>
        <p>Monthly support, early access to posts and videos, and a say in what gets covered next.</p>
        <a class="btn btn-crimson" href="${esc(config.patreonUrl)}" target="_blank" rel="noopener">Become a patron ${icons.external}</a>
      </div>
      <div class="platform-card">
        <h3>${icons.coffee} Buy Me a Coffee</h3>
        <p>One-off support, no commitment. Genuinely helps cover the hardware that gets torn apart here.</p>
        <a class="btn btn-primary" href="${esc(config.bmcUrl)}" target="_blank" rel="noopener">Buy a coffee ${icons.external}</a>
      </div>
    </div>
  </div>
</section>`;

  return layout(
    {
      title: config.siteName,
      description: config.siteDescription,
      url: '/',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: config.siteName,
        url: config.siteUrl,
        description: config.siteDescription,
        author: { '@type': 'Person', name: config.authorName },
      },
    },
    body,
    { stats, current: '/' }
  );
}

export function blogIndexPage(posts, { title = 'Blog', description, url = '/blog/', intro, current } = {}) {
  const body = `
<section class="hero">
  <div class="wrap">
    <div class="eyebrow">${posts.length} ${posts.length === 1 ? 'entry' : 'entries'}</div>
    <h1 class="hero-title">${esc(title)}</h1>
    ${intro ? `<p class="hero-lede">${esc(intro)}</p>` : ''}
  </div>
</section>

<section class="section">
  <div class="wrap">
    ${
      posts.length
        ? `<div class="grid grid-2">${posts.map((p) => postCard(p)).join('\n      ')}</div>`
        : emptyState('Nothing here yet', 'New posts show up automatically once they land in <code>content/blog/</code>.')
    }
  </div>
</section>`;

  return layout(
    { title, description: description || `${title} — ${config.siteName}`, url },
    body,
    { current: current || url }
  );
}

export function postPage(post, { prev, next, gear = [] } = {}) {
  const toc = post.headings.length
    ? `<aside class="toc-rail">
  <div class="toc-head">On this page</div>
  <ul class="toc-list">
    ${post.headings
      .map(
        (h) =>
          `<li class="depth-${h.depth}"><a href="#${encodeURIComponent(h.id)}">${esc(h.text)}</a></li>`
      )
      .join('\n    ')}
  </ul>
</aside>`
    : '<aside class="toc-rail"></aside>';

  const verdict =
    post.isReview && (post.rating != null || post.pros.length || post.cons.length)
      ? `<div class="verdict">
  <div class="verdict-top">
    ${post.rating != null ? `<div class="score score-lg"><span class="score-value">${post.rating}</span><span class="score-max">/10</span></div>` : ''}
    <div class="verdict-copy">
      <div class="verdict-label">The verdict</div>
      <div class="verdict-text">${esc(post.verdict || post.description)}</div>
    </div>
  </div>
  ${
    post.pros.length || post.cons.length
      ? `<div class="verdict-cols">
    <div class="verdict-col pros">
      <h4>What works</h4>
      <ul>${post.pros.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
    </div>
    <div class="verdict-col cons">
      <h4>What doesn't</h4>
      <ul>${post.cons.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
    </div>
  </div>`
      : ''
  }
  ${
    post.specs
      ? `<div class="verdict-col"><h4>Specifications</h4><table class="spec-table"><tbody>${Object.entries(
          post.specs
        )
          .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(String(v))}</td></tr>`)
          .join('')}</tbody></table></div>`
      : ''
  }
  ${
    post.productUrl
      ? `<div class="verdict-col"><a class="btn btn-primary" href="${esc(post.productUrl)}" target="_blank" rel="noopener sponsored">${esc(post.productName || 'Check current price')} ${icons.external}</a></div>`
      : ''
  }
</div>`
      : '';

  const relatedGear = gear.length
    ? `<section class="section">
  <div class="section-head"><h2 class="section-title">Mentioned in this post</h2></div>
  <div class="grid grid-3">${gear.map(gearCard).join('\n  ')}</div>
</section>`
    : '';

  const hasAffiliate = post.html.includes('data-affiliate') || gear.length > 0 || post.productUrl;

  const body = `
<article>
  <header class="article-header">
    <div class="wrap-text">
      <div class="card-meta">
        ${post.isReview ? '<span class="badge badge-review">Review</span>' : ''}
        ${post.type === 'guide' ? '<span class="badge badge-guide">Guide</span>' : ''}
        ${post.type === 'project' ? '<span class="badge badge-project">Project</span>' : ''}
        ${post.dateDisplay ? `<span>${esc(post.dateDisplay)}</span>` : ''}
        <span class="sep">·</span><span>${post.readingTime} min read</span>
      </div>
      <h1 class="article-title">${esc(post.title)}</h1>
      <p class="article-lede">${esc(post.description)}</p>
      <div class="article-meta">
        <span>By ${esc(post.author)}</span>
        ${
          post.tags.length
            ? `<span class="sep">·</span><div class="tag-list">${post.tags
                .map((t) => `<a class="tag" href="/tags/${slugify(t)}/">${esc(t)}</a>`)
                .join('')}</div>`
            : ''
        }
      </div>
    </div>
    ${
      post.cover
        ? `<div class="wrap"><div class="article-cover"><img src="${esc(post.cover)}" alt="${esc(post.coverAlt)}"></div></div>`
        : ''
    }
  </header>

  <div class="wrap">
    <div class="article-layout">
      <div>
        ${verdict}
        ${hasAffiliate ? disclosure() : ''}
        <div class="prose">
${post.html}
        </div>
        ${
          post.video
            ? `<div class="callout">${brandIcons.youtube}<span>There's a video version of this: <a href="${esc(post.video)}" target="_blank" rel="noopener">watch it on YouTube</a>.</span></div>`
            : ''
        }
        ${
          post.repo
            ? `<div class="callout">${icons.code}<span>Source for this project lives on <a href="${esc(post.repo)}" target="_blank" rel="noopener">GitHub</a>.</span></div>`
            : ''
        }
        ${relatedGear}

        <nav class="post-nav">
          ${
            prev
              ? `<a href="${esc(prev.url)}"><span class="dir">← Previous</span><span class="ttl">${esc(prev.title)}</span></a>`
              : '<span></span>'
          }
          ${
            next
              ? `<a class="next" href="${esc(next.url)}"><span class="dir">Next →</span><span class="ttl">${esc(next.title)}</span></a>`
              : '<span></span>'
          }
        </nav>

        <div class="support-split" style="margin-top:26px">
          <div class="platform-card">
            <h3>Found this useful?</h3>
            <p>Posts like this take a while. A coffee genuinely helps.</p>
            <a class="btn btn-primary" href="${esc(config.bmcUrl)}" target="_blank" rel="noopener">${icons.coffee} Buy me a coffee</a>
          </div>
          <div class="platform-card">
            <h3>Want it earlier?</h3>
            <p>Patrons get posts and videos before they go public.</p>
            <a class="btn btn-crimson" href="${esc(config.patreonUrl)}" target="_blank" rel="noopener">${brandIcons.patreon} Join on Patreon</a>
          </div>
        </div>
      </div>
      ${toc}
    </div>
  </div>
</article>`;

  return layout(
    {
      title: post.title,
      description: post.description,
      url: post.url,
      image: post.cover,
      type: 'article',
      published: post.date,
      tags: post.tags,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': post.isReview ? 'Review' : 'BlogPosting',
        headline: post.title,
        description: post.description,
        datePublished: post.date,
        dateModified: post.updated || post.date,
        author: { '@type': 'Person', name: post.author },
        publisher: { '@type': 'Organization', name: config.siteName },
        mainEntityOfPage: `${config.siteUrl}${post.url}`,
        ...(post.cover ? { image: `${config.siteUrl}${post.cover}` } : {}),
        ...(post.isReview && post.rating != null
          ? {
              reviewRating: {
                '@type': 'Rating',
                ratingValue: post.rating,
                bestRating: 10,
                worstRating: 0,
              },
              itemReviewed: { '@type': 'Product', name: post.productName || post.title },
            }
          : {}),
      },
    },
    body,
    { current: '/blog/' }
  );
}

export function videosPage(youtube) {
  const videos = youtube.videos || [];
  const ch = youtube.channel || {};
  const body = `
<section class="hero">
  <div class="wrap">
    <div class="eyebrow">${esc(config.youtubeHandle)}</div>
    <h1 class="hero-title">Videos</h1>
    <p class="hero-lede">Everything from the channel, newest first.${
      ch.subscribersDisplay ? ` <strong>${esc(ch.subscribersDisplay)} subscribers</strong>.` : ''
    }</p>
    <div class="hero-cta">
      <a class="btn btn-crimson" href="${esc(ch.url || `https://www.youtube.com/${config.youtubeHandle}`)}" target="_blank" rel="noopener">
        ${brandIcons.youtube} Subscribe ${icons.external}
      </a>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    ${
      videos.length
        ? `<div class="grid grid-3">${videos.map(videoCard).join('\n      ')}</div>`
        : emptyState(
            'No videos loaded yet',
            'Add <code>YOUTUBE_CHANNEL_ID</code> to your repository secrets (and optionally <code>YOUTUBE_API_KEY</code> for view counts and durations), then re-run the build.'
          )
    }
    ${
      youtube.sample
        ? `<div class="callout" style="margin-top:26px">${icons.clock}<span><strong>Showing sample data.</strong> Set <code>YOUTUBE_CHANNEL_ID</code> to pull your real uploads.</span></div>`
        : ''
    }
  </div>
</section>`;

  return layout(
    { title: 'Videos', description: `Videos from ${config.youtubeHandle}.`, url: '/videos/' },
    body,
    { current: '/videos/' }
  );
}

export function projectsPage(github) {
  const repos = github.repos || [];
  const body = `
<section class="hero">
  <div class="wrap">
    <div class="eyebrow">github.com/${esc(config.githubUsername)}</div>
    <h1 class="hero-title">Projects</h1>
    <p class="hero-lede">Public repositories, pulled straight from GitHub and sorted by stars. ${
      github.totals?.stars ? `<strong>${github.totals.stars} stars</strong> across everything.` : ''
    }</p>
    <div class="hero-cta">
      <a class="btn" href="https://github.com/${esc(config.githubUsername)}" target="_blank" rel="noopener">
        ${brandIcons.github} View profile ${icons.external}
      </a>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    ${
      repos.length
        ? `<div class="grid grid-3">${repos.map(repoCard).join('\n      ')}</div>`
        : emptyState('No repositories loaded', 'Set <code>GH_USERNAME</code> and re-run the build.')
    }
    ${
      github.sample
        ? `<div class="callout" style="margin-top:26px">${icons.clock}<span><strong>Showing sample data.</strong> This fills in automatically on the first build with network access — public repo data needs no token.</span></div>`
        : ''
    }
  </div>
</section>`;

  return layout(
    { title: 'Projects', description: `Open-source projects by ${config.authorName}.`, url: '/projects/' },
    body,
    { current: '/projects/' }
  );
}

export function gearPage(gear) {
  const categories = [...new Set(gear.map((g) => g.category || 'Other'))];
  const body = `
<section class="hero">
  <div class="wrap">
    <div class="eyebrow">Affiliate links</div>
    <h1 class="hero-title">The gear list</h1>
    <p class="hero-lede">Everything I actually use, not everything I've been sent. If something is on this list it's because it survived real work.</p>
  </div>
</section>

<section class="section">
  <div class="wrap">
    ${disclosure()}
    ${
      gear.length
        ? categories
            .map(
              (cat) => `<div style="margin-top:40px">
      <div class="section-head"><h2 class="section-title">${esc(cat)}</h2></div>
      <div class="grid grid-3">${gear
        .filter((g) => (g.category || 'Other') === cat)
        .map(gearCard)
        .join('\n      ')}</div>
    </div>`
            )
            .join('\n')
        : emptyState('No gear listed', 'Add items to <code>content/data/gear.json</code>.')
    }
  </div>
</section>`;

  return layout(
    { title: 'Gear', description: 'The hardware and software behind the channel.', url: '/gear/' },
    body,
    { current: '/gear/' }
  );
}

export function supportPage({ patreon }) {
  const tiers = patreon.tiers || [];

  const body = `
<section class="hero">
  <div class="wrap">
    <div class="eyebrow">Thank you</div>
    <h1 class="hero-title">Support the<br><em>work</em></h1>
    <p class="hero-lede">Reviews mean buying hardware. Projects mean time. Both are paid for by people who chip in — there are no sponsored verdicts here, and there never will be.</p>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="support-split">
      <div class="platform-card">
        <h3>${brandIcons.patreon} Patreon</h3>
        <p>Recurring support with perks. Early access to everything, the raw benchmark data behind reviews, and a vote on what gets covered next.</p>
        <a class="btn btn-crimson" href="${esc(patreon.url || config.patreonUrl)}" target="_blank" rel="noopener">Become a patron ${icons.external}</a>
      </div>
      <div class="platform-card">
        <h3>${icons.coffee} Buy Me a Coffee</h3>
        <p>One-off, no subscription, no account needed. The simplest way to say a post was worth your time.</p>
        <a class="btn btn-primary" href="${esc(config.bmcUrl)}" target="_blank" rel="noopener">Buy a coffee ${icons.external}</a>
      </div>
    </div>
  </div>
</section>

${
  tiers.length
    ? `<section class="section">
  <div class="wrap">
    <div class="section-head">
      <h2 class="section-title">Patreon tiers ${sampleBadge(patreon, 'PATREON_ACCESS_TOKEN')}</h2>
    </div>
    <div class="grid grid-3">
      ${tiers
        .map(
          (t) => `<div class="tier reveal">
        <div class="tier-name">${esc(t.title)}</div>
        <div class="tier-price">${esc(t.amountDisplay)}<small> / month</small></div>
        <p class="tier-desc">${esc(t.description)}</p>
        <a class="btn btn-crimson" href="${esc(t.url)}" target="_blank" rel="noopener">Join ${icons.arrowRight}</a>
      </div>`
        )
        .join('\n      ')}
    </div>
  </div>
</section>`
    : ''
}

${
  patreon.sample
    ? `<section class="section"><div class="wrap">
  <div class="callout">${icons.clock}<span><strong>These tiers are sample data.</strong> Add <code>PATREON_ACCESS_TOKEN</code> to your repository secrets to show your real tiers. See the README for how to generate one.</span></div>
</div></section>`
    : ''
}`;

  return layout(
    { title: 'Support', description: `Support ${config.siteName} on Patreon or Buy Me a Coffee.`, url: '/support/' },
    body,
    { current: '/support/' }
  );
}

export function aboutPage({ page, github, youtube }) {
  const body = `
<section class="hero">
  <div class="wrap">
    <div class="eyebrow">About</div>
    <h1 class="hero-title">${esc(page?.title || config.authorName)}</h1>
    <p class="hero-lede">${esc(config.authorBio)}</p>
    <div class="hero-cta">
      <a class="btn" href="https://www.youtube.com/${esc(config.youtubeHandle)}" target="_blank" rel="noopener">${brandIcons.youtube} YouTube</a>
      <a class="btn" href="https://github.com/${esc(config.githubUsername)}" target="_blank" rel="noopener">${brandIcons.github} GitHub</a>
      ${config.contactEmail ? `<a class="btn" href="mailto:${esc(config.contactEmail)}">${brandIcons.mail} Email</a>` : ''}
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap-text">
    <div class="prose">
${page?.html || '<p>Add <code>content/pages/about.md</code> to write this page.</p>'}
    </div>
  </div>
</section>`;

  return layout(
    { title: 'About', description: config.authorBio, url: '/about/' },
    body,
    { current: '/about/' }
  );
}

export function notFoundPage() {
  const body = `
<section class="hero" style="padding:110px 0">
  <div class="wrap" style="text-align:center">
    <div class="eyebrow">Error 404</div>
    <h1 class="hero-title">This page<br><em>doesn't exist</em></h1>
    <p class="hero-lede" style="margin-inline:auto">Either it moved, or it never existed. Both happen.</p>
    <div class="hero-cta" style="justify-content:center">
      <a class="btn btn-primary" href="/">Back home</a>
      <a class="btn" href="/blog/">Browse the blog</a>
    </div>
  </div>
</section>`;

  return layout(
    { title: 'Page not found', description: 'That page does not exist.', url: '/404.html', noindex: true },
    body
  );
}

export { postCard, videoCard, repoCard, gearCard };
