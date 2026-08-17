#!/usr/bin/env node
/**
 * Scaffold a new post with correct front matter.
 *
 *   npm run new -- "Post title"
 *   npm run new -- "Thing X Review" --type review
 *   npm run new -- "How to do Y"    --type guide --draft
 */

import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../src/lib/config.mjs';
import { slugify } from '../src/lib/content.mjs';

const args = process.argv.slice(2);
const title = args.find((a) => !a.startsWith('--'));

if (!title) {
  console.error('Usage: npm run new -- "Post title" [--type review|guide|project|post] [--draft]');
  process.exit(1);
}

const typeIndex = args.indexOf('--type');
const type = typeIndex !== -1 ? args[typeIndex + 1] : 'post';
const isDraft = args.includes('--draft');
const slug = slugify(title);
const today = new Date().toISOString().slice(0, 10);
const file = path.join(ROOT, 'content/blog', `${slug}.md`);

if (fs.existsSync(file)) {
  console.error(`Already exists: content/blog/${slug}.md`);
  process.exit(1);
}

const reviewFields = `rating: 8
productName: ""
productUrl: ""
verdict: >
  One sentence that sums the whole thing up.
pros:
  - Something that genuinely works
  - Another thing
cons:
  - Something that genuinely does not
specs:
  Key: Value
`;

const frontmatter = `---
title: "${title.replace(/"/g, '\\"')}"
date: ${today}
description: "One or two sentences. This is what shows on cards, in search results and in link previews."
tags: []
type: ${type}
${isDraft ? 'draft: true\n' : ''}${type === 'review' ? reviewFields : ''}# Optional:
# cover: /assets/covers/${slug}.jpg
# featured: true
# video: https://www.youtube.com/watch?v=...
# repo: https://github.com/...
# gear: [gear-id-from-content/data/gear.json]
---

Opening paragraph. The first letter gets a drop cap, so start with something worth looking at.

## First section

Write here.
`;

fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, frontmatter);

console.log(`\nCreated content/blog/${slug}.md`);
console.log(`URL will be /blog/${slug}/`);
console.log(`\nPreview with:  npm run dev\n`);
