/**
 * Loads Markdown content from content/blog and turns it into post objects.
 */

import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import hljs from 'highlight.js';
import { parseFrontmatter } from './frontmatter.mjs';
import { config, ROOT } from './config.mjs';

const BLOG_DIR = path.join(ROOT, 'content/blog');
const PAGES_DIR = path.join(ROOT, 'content/pages');

/** Escape text for safe interpolation into HTML. */
export function esc(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function slugify(s = '') {
  return String(s)
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Add the Amazon Associates tag to bare Amazon links so a single secret
 * controls monetisation across every post.
 */
function withAffiliateTag(href) {
  if (!config.amazonTag || !href) return href;
  try {
    const u = new URL(href);
    if (!/(^|\.)amazon\.[a-z.]+$/i.test(u.hostname)) return href;
    if (!u.searchParams.has('tag')) u.searchParams.set('tag', config.amazonTag);
    return u.toString();
  } catch {
    return href;
  }
}

const isExternal = (href = '') => /^https?:\/\//i.test(href);

/** Build a marked renderer that collects headings for a table of contents. */
function makeRenderer(headings) {
  const renderer = new marked.Renderer();
  const seen = new Map();

  renderer.heading = function ({ tokens, depth }) {
    const text = this.parser.parseInline(tokens);
    const plain = text.replace(/<[^>]+>/g, '');
    let id = slugify(plain) || `section-${headings.length + 1}`;
    if (seen.has(id)) {
      const n = seen.get(id) + 1;
      seen.set(id, n);
      id = `${id}-${n}`;
    } else {
      seen.set(id, 1);
    }
    if (depth === 2 || depth === 3) headings.push({ id, text: plain, depth });
    return `<h${depth} id="${id}"><a class="anchor" href="#${id}" aria-label="Link to this section">#</a>${text}</h${depth}>\n`;
  };

  renderer.link = function ({ href, title, tokens }) {
    const text = this.parser.parseInline(tokens);
    const url = withAffiliateTag(href);
    const attrs = [`href="${esc(url)}"`];
    if (title) attrs.push(`title="${esc(title)}"`);
    if (isExternal(url)) attrs.push('target="_blank"', 'rel="noopener noreferrer"');
    // Mark monetised links so the stylesheet can badge them.
    if (config.amazonTag && url !== href) attrs.push('data-affiliate="true"');
    return `<a ${attrs.join(' ')}>${text}</a>`;
  };

  // Highlight at build time so the browser ships no highlighter at all.
  renderer.code = function ({ text, lang }) {
    const language = (lang || '').split(/\s+/)[0].toLowerCase();
    let highlighted;
    let cls = 'hljs';

    if (language && hljs.getLanguage(language)) {
      try {
        highlighted = hljs.highlight(text, { language, ignoreIllegals: true }).value;
        cls += ` language-${language}`;
      } catch {
        highlighted = esc(text);
      }
    } else {
      highlighted = esc(text);
    }
    return `<pre><code class="${cls}">${highlighted}</code></pre>\n`;
  };

  renderer.image = function ({ href, title, text }) {
    const attrs = [
      `src="${esc(href)}"`,
      `alt="${esc(text || '')}"`,
      'loading="lazy"',
      'decoding="async"',
    ];
    if (title) attrs.push(`title="${esc(title)}"`);
    return `<img ${attrs.join(' ')} />`;
  };

  return renderer;
}

export function renderMarkdown(md) {
  const headings = [];
  const html = marked.parse(md || '', {
    gfm: true,
    breaks: false,
    renderer: makeRenderer(headings),
  });
  return { html, headings };
}

function readingTime(md) {
  const words = String(md).trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

function excerptFrom(md, limit = 180) {
  const plain = String(md)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= limit) return plain;
  return plain.slice(0, plain.lastIndexOf(' ', limit)) + '…';
}

/** ISO date -> "14 August 2026". Invalid/missing dates return ''. */
export function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function normalisePost(file, raw) {
  const { data, content } = parseFrontmatter(raw);
  const slug = data.slug || path.basename(file, '.md');
  const { html, headings } = renderMarkdown(content);

  const type = (data.type || 'post').toLowerCase();
  const tags = (Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : []).map(String);

  return {
    slug,
    url: `/blog/${slug}/`,
    title: data.title || slug,
    date: data.date ? String(data.date) : '',
    dateDisplay: formatDate(data.date),
    updated: data.updated ? String(data.updated) : '',
    description: data.description || excerptFrom(content),
    excerpt: excerptFrom(content),
    tags,
    type,
    isReview: type === 'review',
    cover: data.cover || '',
    coverAlt: data.coverAlt || data.title || '',
    author: data.author || config.authorName,
    featured: data.featured === true,
    draft: data.draft === true,
    readingTime: readingTime(content),

    // Review-specific fields
    rating: typeof data.rating === 'number' ? data.rating : null,
    verdict: data.verdict || '',
    pros: Array.isArray(data.pros) ? data.pros : [],
    cons: Array.isArray(data.cons) ? data.cons : [],
    specs: data.specs && typeof data.specs === 'object' ? data.specs : null,
    productName: data.productName || '',
    productUrl: withAffiliateTag(data.productUrl || ''),
    productPrice: data.productPrice || '',

    // Cross-linking
    video: data.video || '',
    repo: data.repo || '',
    gear: Array.isArray(data.gear) ? data.gear : [],

    markdown: content,
    html,
    headings,
    sourceFile: path.relative(ROOT, file),
  };
}

export function loadPosts({ includeDrafts = false } = {}) {
  if (!fs.existsSync(BLOG_DIR)) return [];

  const files = fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .map((f) => path.join(BLOG_DIR, f));

  const posts = [];
  for (const file of files) {
    try {
      posts.push(normalisePost(file, fs.readFileSync(file, 'utf8')));
    } catch (err) {
      console.warn(`  ! skipped ${path.basename(file)}: ${err.message}`);
    }
  }

  return posts
    .filter((p) => includeDrafts || !p.draft)
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.title.localeCompare(b.title));
}

export function loadPages() {
  if (!fs.existsSync(PAGES_DIR)) return [];
  return fs
    .readdirSync(PAGES_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const file = path.join(PAGES_DIR, f);
      const { data, content } = parseFrontmatter(fs.readFileSync(file, 'utf8'));
      const { html, headings } = renderMarkdown(content);
      return {
        slug: data.slug || path.basename(f, '.md'),
        title: data.title || path.basename(f, '.md'),
        description: data.description || '',
        html,
        headings,
      };
    });
}

/** All tags with counts, most used first. */
export function collectTags(posts) {
  const counts = new Map();
  for (const p of posts) for (const t of p.tags) counts.set(t, (counts.get(t) || 0) + 1);
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, slug: slugify(tag), count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** Gear / affiliate products from content/data/gear.json. */
export function loadGear() {
  const p = path.join(ROOT, 'content/data/gear.json');
  let items = [];
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
    items = Array.isArray(parsed) ? parsed : parsed.items || [];
  } catch {
    return [];
  }
  return items.map((it) => ({
    ...it,
    id: it.id || slugify(it.name || ''),
    url: withAffiliateTag(it.url || ''),
  }));
}
