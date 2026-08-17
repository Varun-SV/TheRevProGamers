/**
 * A small, dependency-free YAML-subset front matter parser.
 *
 * Supports everything the content in this repo needs:
 *   key: value                     scalars (string / number / bool / null)
 *   key: "quoted: value"           quoted strings
 *   key: [a, b, c]                 inline arrays
 *   key: [{"a":1}]                 inline JSON (tried first for [ ] and { })
 *   key:                           block arrays
 *     - one
 *     - two
 *   key:                           block arrays of maps
 *     - name: one
 *       url: https://x
 *   key:                           nested maps
 *     sub: value
 *   key: |                         literal block scalar (keeps newlines)
 *   key: >                         folded block scalar (joins lines)
 *
 * It is deliberately forgiving: anything it cannot classify becomes a string.
 */

/** Split on commas that are not inside quotes, brackets or braces. */
function splitTop(input) {
  const parts = [];
  let buf = '';
  let depth = 0;
  let quote = null;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (quote) {
      if (ch === '\\' && i + 1 < input.length) {
        buf += ch + input[++i];
        continue;
      }
      if (ch === quote) quote = null;
      buf += ch;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      buf += ch;
      continue;
    }
    if (ch === '[' || ch === '{') depth++;
    if (ch === ']' || ch === '}') depth--;

    if (ch === ',' && depth === 0) {
      parts.push(buf);
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.trim() !== '') parts.push(buf);
  return parts.map((p) => p.trim());
}

/** Strip a trailing ` # comment` that is not inside quotes. */
function stripComment(s) {
  let quote = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '#' && (i === 0 || /\s/.test(s[i - 1]))) return s.slice(0, i);
  }
  return s;
}

function parseScalar(raw) {
  const s = stripComment(String(raw)).trim();

  if (s === '' ) return '';
  if (s === 'true' || s === 'yes') return true;
  if (s === 'false' || s === 'no') return false;
  if (s === 'null' || s === '~') return null;

  // Quoted string
  if ((s.startsWith('"') && s.endsWith('"') && s.length > 1) ||
      (s.startsWith("'") && s.endsWith("'") && s.length > 1)) {
    return s
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\n/g, '\n');
  }

  // Numbers — but never mangle things that merely start with digits (dates, versions)
  if (/^-?\d+$/.test(s) || /^-?\d*\.\d+$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) return n;
  }

  // Bracketed values: real JSON wins, loose comma lists are the fallback
  const bracketed =
    (s.startsWith('[') && s.endsWith(']')) || (s.startsWith('{') && s.endsWith('}'));
  if (bracketed) {
    try {
      return JSON.parse(s);
    } catch {
      /* fall through */
    }
    const inner = s.slice(1, -1).trim();
    if (inner === '') return s.startsWith('[') ? [] : {};
    if (s.startsWith('[')) return splitTop(inner).map(parseScalar);
    const obj = {};
    for (const part of splitTop(inner)) {
      const idx = part.indexOf(':');
      if (idx === -1) continue;
      obj[part.slice(0, idx).trim()] = parseScalar(part.slice(idx + 1));
    }
    return obj;
  }

  return s;
}

const indentOf = (line) => {
  const i = line.search(/\S/);
  return i === -1 ? -1 : i;
};

const KEY_RE = /^([A-Za-z0-9_$][A-Za-z0-9_$ .-]*?)\s*:(?:\s+(.*))?$/;

/**
 * Parse a block of lines at (or deeper than) `indent`.
 * Returns [value, nextLineIndex].
 */
function parseBlock(lines, start, indent) {
  const obj = {};
  const arr = [];
  let isArray = false;
  let i = start;

  while (i < lines.length) {
    const rawLine = lines[i];
    const ind = indentOf(rawLine);

    if (ind === -1) { i++; continue; }                       // blank line
    if (ind < indent) break;                                 // dedented out of this block

    const text = rawLine.trim();
    if (text.startsWith('#')) { i++; continue; }             // whole-line comment

    // ── Array item ────────────────────────────────────────
    if (text === '-' || text.startsWith('- ')) {
      isArray = true;
      const rest = text === '-' ? '' : text.slice(2).trim();

      if (rest === '') {
        const [child, next] = parseBlock(lines, i + 1, ind + 1);
        arr.push(child);
        i = next;
        continue;
      }

      // "- key: value" starts a map item; following deeper lines belong to it.
      const m = rest.match(KEY_RE);
      const looksLikeUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(rest);
      if (m && !looksLikeUrl) {
        const itemIndent = ind + 2;
        const item = {};
        const key = m[1].trim();
        const inlineVal = m[2];

        if (inlineVal == null || inlineVal.trim() === '') {
          const [child, next] = parseBlock(lines, i + 1, itemIndent + 1);
          item[key] = child;
          i = next;
        } else {
          item[key] = parseScalar(inlineVal);
          i++;
        }

        const [restOfItem, next] = parseBlock(lines, i, itemIndent);
        if (restOfItem && !Array.isArray(restOfItem)) Object.assign(item, restOfItem);
        i = next;
        arr.push(item);
        continue;
      }

      arr.push(parseScalar(rest));
      i++;
      continue;
    }

    // ── key: value ────────────────────────────────────────
    const m = text.match(KEY_RE);
    if (!m) { i++; continue; }

    const key = m[1].trim();
    const inline = m[2] == null ? '' : m[2].trim();

    // Block scalars: | keeps newlines, > folds them into spaces
    if (inline === '|' || inline === '|-' || inline === '>' || inline === '>-') {
      const fold = inline.startsWith('>');
      const chomp = inline.endsWith('-');
      const collected = [];
      let j = i + 1;
      let blockIndent = null;
      while (j < lines.length) {
        const li = indentOf(lines[j]);
        if (li === -1) { collected.push(''); j++; continue; }
        if (li <= indent) break;
        if (blockIndent === null) blockIndent = li;
        collected.push(lines[j].slice(blockIndent));
        j++;
      }
      while (collected.length && collected[collected.length - 1] === '') collected.pop();
      let text2 = fold
        ? collected.reduce((acc, line) => {
            if (line === '') return acc + '\n\n';
            return acc && !acc.endsWith('\n') ? acc + ' ' + line : acc + line;
          }, '')
        : collected.join('\n');
      if (!chomp && !fold) text2 += '';
      obj[key] = text2.trim();
      i = j;
      continue;
    }

    if (inline === '') {
      // Value lives on the following, more-indented lines (or is genuinely empty)
      const nextMeaningful = (() => {
        let j = i + 1;
        while (j < lines.length && indentOf(lines[j]) === -1) j++;
        return j;
      })();
      const childIndent = nextMeaningful < lines.length ? indentOf(lines[nextMeaningful]) : -1;

      if (childIndent > ind) {
        const [child, next] = parseBlock(lines, i + 1, childIndent);
        obj[key] = child;
        i = next;
      } else {
        obj[key] = '';
        i++;
      }
      continue;
    }

    obj[key] = parseScalar(inline);
    i++;
  }

  return [isArray ? arr : obj, i];
}

/**
 * Split a document into { data, content }.
 * A document without a leading `---` fence yields empty data.
 */
export function parseFrontmatter(raw) {
  const src = String(raw).replace(/^﻿/, '').replace(/\r\n?/g, '\n');

  if (!src.startsWith('---')) return { data: {}, content: src.trim() };

  const lines = src.split('\n');
  if (lines[0].trim() !== '---') return { data: {}, content: src.trim() };

  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === '---' || t === '...') { end = i; break; }
  }
  if (end === -1) return { data: {}, content: src.trim() };

  const fmLines = lines.slice(1, end);
  const body = lines.slice(end + 1).join('\n').trim();

  let data = {};
  try {
    const [parsed] = parseBlock(fmLines, 0, 0);
    if (parsed && !Array.isArray(parsed)) data = parsed;
  } catch (err) {
    console.warn(`  ! front matter parse failed: ${err.message}`);
  }

  return { data, content: body };
}

export default parseFrontmatter;
