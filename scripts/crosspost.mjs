#!/usr/bin/env node
/**
 * Cross-post a published blog post to every platform that will accept it.
 *
 *   node scripts/crosspost.mjs                 # posts added in the last commit
 *   node scripts/crosspost.mjs --post <slug>   # one specific post
 *   node scripts/crosspost.mjs --all           # every published post (careful)
 *   node scripts/crosspost.mjs --dry-run       # render everything, send nothing
 *
 * ── Why this is only half-automatic ──────────────────────────────────
 *
 * Patreon and Buy Me a Coffee have NO public API for creating a post:
 *
 *   · Patreon API v2 — `campaigns.posts` is a READ scope. The only write
 *     scope in the whole API is `w:campaigns.webhook`. Post creation is a
 *     long-standing, unimplemented feature request.
 *   · Buy Me a Coffee API v1 — three GET collections (supporters,
 *     subscriptions, extras). No write side at all.
 *
 * Zapier/Make don't help either: both platforms are trigger-only there.
 *
 * So for those two this script renders the post into each platform's preferred
 * format and hands you paste-ready text plus a direct link to the composer —
 * about fifteen seconds of work per platform. Everything that genuinely has a
 * write API (Discord, Telegram, Mastodon, Dev.to) is posted automatically.
 *
 * The alternative would be driving their web UI with stored credentials, which
 * means putting a password for a money-handling account into CI and having it
 * break the first time a button moves. Not worth it.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { config, enabled, ROOT } from '../src/lib/config.mjs';
import { loadPosts } from '../src/lib/content.mjs';
import { postJson } from '../src/lib/http.mjs';

const OUT_DIR = path.join(ROOT, '.crosspost');
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

const flagValue = (name) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
};

/* ── Which posts? ──────────────────────────────────────────────────── */

/** Slugs of posts added or changed in the most recent commit. */
function slugsFromLastCommit() {
  try {
    const out = execSync('git diff-tree --no-commit-id --name-only --diff-filter=AM -r HEAD', {
      cwd: ROOT,
      encoding: 'utf8',
    });
    return out
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('content/blog/') && l.endsWith('.md'))
      .map((l) => path.basename(l, '.md'));
  } catch {
    return [];
  }
}

function selectPosts() {
  const posts = loadPosts();
  if (args.includes('--all')) return posts;

  const one = flagValue('--post');
  if (one) {
    const found = posts.find((p) => p.slug === one);
    if (!found) {
      console.error(`No published post with slug "${one}".`);
      console.error(`Available: ${posts.map((p) => p.slug).join(', ')}`);
      process.exit(1);
    }
    return [found];
  }

  const slugs = slugsFromLastCommit();
  return posts.filter((p) => slugs.includes(p.slug));
}

/* ── Renderers ─────────────────────────────────────────────────────── */

const permalink = (post) => `${config.siteUrl}${post.url}`;

/** Strip Markdown to readable plain text, for platforms without formatting. */
function toPlainText(md, limit = 900) {
  const text = md
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`]/g, '')
    .replace(/^>\s?/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

/** Remove the editor-note comments before anything is published anywhere. */
const cleanMarkdown = (md) => md.replace(/<!--[\s\S]*?-->/g, '').trim();

function renderPatreon(post) {
  const body = cleanMarkdown(post.markdown);
  return `${post.title}

${post.description}

${body}

────────────────────────────────
Read it on the site (with the full formatting, code blocks and images):
${permalink(post)}

Thank you for supporting this — the hardware in these posts is bought, not gifted, and that is only possible because of you.`;
}

function renderBmc(post) {
  return `${post.title}

${post.description}

${toPlainText(post.markdown, 1400)}

Read the full post here: ${permalink(post)}

If this was useful, another coffee always helps. Thank you.`;
}

function renderShort(post, maxLength) {
  const link = permalink(post);
  const tags = post.tags.slice(0, 3).map((t) => `#${t.replace(/[^a-z0-9]/gi, '')}`).join(' ');
  const head = `${post.title}\n\n`;
  const tail = `\n\n${link}${tags ? `\n\n${tags}` : ''}`;
  const room = maxLength - head.length - tail.length;
  return head + toPlainText(post.description, Math.max(60, room)) + tail;
}

/* ── Auto-posting (platforms that actually have a write API) ───────── */

async function sendDiscord(post) {
  const payload = {
    username: config.siteName,
    embeds: [
      {
        title: post.title.slice(0, 250),
        url: permalink(post),
        description: post.description.slice(0, 400),
        color: 0xe8c547,
        timestamp: post.date ? new Date(post.date).toISOString() : undefined,
        footer: { text: `${config.siteName} · ${post.readingTime} min read` },
        ...(post.cover
          ? { image: { url: post.cover.startsWith('http') ? post.cover : `${config.siteUrl}${post.cover}` } }
          : {}),
        fields: post.tags.length
          ? [{ name: 'Tags', value: post.tags.map((t) => `\`${t}\``).join(' '), inline: true }]
          : undefined,
      },
    ],
  };
  return postJson(config.discordWebhookUrl, payload);
}

async function sendTelegram(post) {
  const text =
    `*${post.title.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1')}*\n\n` +
    `${post.description.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1')}\n\n` +
    permalink(post);
  return postJson(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
    chat_id: config.telegramChatId,
    text,
    parse_mode: 'MarkdownV2',
    disable_web_page_preview: false,
  });
}

async function sendMastodon(post) {
  return postJson(
    `${config.mastodonInstanceUrl}/api/v1/statuses`,
    { status: renderShort(post, 500), visibility: 'public' },
    { headers: { Authorization: `Bearer ${config.mastodonAccessToken}` } }
  );
}

async function sendDevto(post) {
  // canonical_url is essential: it tells search engines your site is the
  // original, so the Dev.to copy never outranks you for your own writing.
  return postJson(
    'https://dev.to/api/articles',
    {
      article: {
        title: post.title,
        body_markdown: cleanMarkdown(post.markdown),
        published: true,
        canonical_url: permalink(post),
        description: post.description,
        tags: post.tags.slice(0, 4).map((t) => t.replace(/[^a-z0-9]/gi, '').toLowerCase()).filter(Boolean),
      },
    },
    { headers: { 'api-key': config.devtoApiKey } }
  );
}

const AUTO_TARGETS = [
  { key: 'discord', label: 'Discord', enabled: () => enabled.discord, send: sendDiscord },
  { key: 'telegram', label: 'Telegram', enabled: () => enabled.telegram, send: sendTelegram },
  { key: 'mastodon', label: 'Mastodon', enabled: () => enabled.mastodon, send: sendMastodon },
  { key: 'devto', label: 'Dev.to', enabled: () => enabled.devto, send: sendDevto },
];

/* ── The manual half ───────────────────────────────────────────────── */

const MANUAL_TARGETS = [
  {
    key: 'patreon',
    label: 'Patreon',
    composer: 'https://www.patreon.com/posts/new',
    render: renderPatreon,
    reason: 'Patreon API v2 has no post-creation endpoint (campaigns.posts is read-only).',
  },
  {
    key: 'bmc',
    label: 'Buy Me a Coffee',
    composer: `https://buymeacoffee.com/${config.bmcUsername}/posts`,
    render: renderBmc,
    reason: 'The Buy Me a Coffee API is read-only (supporters, subscriptions, extras).',
  },
];

function buildIssueBody(post, manualFiles, autoResults) {
  const auto = autoResults.length
    ? autoResults
        .map((r) => `- ${r.ok ? '✅' : '❌'} **${r.label}**${r.error ? ` — ${r.error}` : ''}`)
        .join('\n')
    : '_No auto-post platforms configured yet._';

  return `## 📣 Cross-post: ${post.title}

**Live at:** ${permalink(post)}

---

### ✍️ Needs 15 seconds of copy-paste

Neither platform below has an API for creating posts, so these two are manual by necessity — the text is already written and formatted, you just paste it.

${MANUAL_TARGETS.map(
  (t) => `<details>
<summary><b>${t.label}</b> — <a href="${t.composer}">open the composer ↗</a></summary>

> ${t.reason}

\`\`\`
${manualFiles[t.key]}
\`\`\`

</details>`
).join('\n\n')}

---

### 🤖 Posted automatically

${auto}

---

<sub>Generated by \`scripts/crosspost.mjs\`. Close this issue once the two manual posts are up.</sub>`;
}

/** Open a GitHub issue with the paste-ready text (best effort). */
async function openGitHubIssue(post, body) {
  const token = process.env.GH_API_TOKEN || process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) return { ok: false, error: 'no GITHUB_REPOSITORY / token in env' };

  return postJson(
    `https://api.github.com/repos/${repo}/issues`,
    {
      title: `📣 Cross-post: ${post.title}`,
      body,
      labels: ['crosspost'],
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );
}

/* ── Main ──────────────────────────────────────────────────────────── */

async function main() {
  const posts = selectPosts();

  if (!posts.length) {
    console.log('\nNothing to cross-post (no new posts in the last commit).');
    console.log('Use --post <slug> to pick one explicitly, or --all for everything.\n');
    return;
  }

  console.log(`\nCross-posting ${posts.length} post${posts.length === 1 ? '' : 's'}${DRY_RUN ? ' (dry run)' : ''}\n`);

  for (const post of posts) {
    console.log(`── ${post.title}`);
    const dir = path.join(OUT_DIR, post.slug);
    fs.mkdirSync(dir, { recursive: true });

    // 1. Render the manual platforms to disk
    const manualFiles = {};
    for (const target of MANUAL_TARGETS) {
      const text = target.render(post);
      manualFiles[target.key] = text;
      fs.writeFileSync(path.join(dir, `${target.key}.md`), text);
      console.log(`   ✍️  ${target.label.padEnd(16)} drafted → .crosspost/${post.slug}/${target.key}.md`);
    }

    // 2. Auto-post everywhere with a real write API
    const autoResults = [];
    for (const target of AUTO_TARGETS) {
      if (!target.enabled()) {
        console.log(`   ⊘  ${target.label.padEnd(16)} not configured`);
        continue;
      }
      if (DRY_RUN) {
        console.log(`   ·  ${target.label.padEnd(16)} would post (dry run)`);
        continue;
      }
      const res = await target.send(post);
      autoResults.push({ label: target.label, ok: res.ok, error: res.error });
      console.log(`   ${res.ok ? '✅' : '❌'}  ${target.label.padEnd(16)} ${res.ok ? 'posted' : res.error}`);
    }

    // 3. Leave the paste-ready text somewhere findable
    const issueBody = buildIssueBody(post, manualFiles, autoResults);
    fs.writeFileSync(path.join(dir, 'issue.md'), issueBody);

    if (!DRY_RUN) {
      const issue = await openGitHubIssue(post, issueBody);
      if (issue.ok) {
        console.log(`   📋 GitHub issue      ${issue.data?.html_url || 'created'}`);
      } else {
        console.log(`   📋 GitHub issue      skipped (${issue.error})`);
        console.log(`      Paste-ready text is in .crosspost/${post.slug}/`);
      }
    }
    console.log('');
  }

  console.log('Done.\n');
}

main().catch((err) => {
  console.error('\nCross-post failed:', err);
  process.exit(1);
});
