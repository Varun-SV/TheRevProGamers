/**
 * Rich content blocks for posts, written as fenced code blocks:
 *
 *   ```stats   headline numbers, one per line:  value | label | note | tone
 *   ```chart   a bar or line chart from plain "label: v1, v2" rows
 *   ```note    a callout with an optional title and tone
 *
 * Everything renders to static HTML at build time. The browser ships no
 * charting library, and every chart carries its numbers as a real table so
 * screen readers, RSS readers and search engines get the data too.
 *
 * `blocksToMarkdown()` turns the same blocks into plain Markdown (lists and
 * tables), which is what the cross-posting script sends to Dev.to, Patreon
 * and friends — platforms that would otherwise show the raw fence.
 *
 * A malformed block never fails the build: it warns and falls back to an
 * ordinary code block so the mistake is visible on the page.
 */

const esc = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const BLOCK_LANGS = new Set(['stats', 'chart', 'note']);

const SERIES_COUNT = 4; // --chart-1 … --chart-4 in site.css
const CHART_KEYS = new Set(['title', 'type', 'unit', 'max', 'series', 'caption', 'note', 'labels']);
const NOTE_KEYS = new Set(['title', 'tone']);
const TONES = new Set(['good', 'bad', 'warn', 'info']);

/* ── Parsing ──────────────────────────────────────────────────────── */

const lines = (text) =>
  String(text)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

function parseStats(text) {
  const items = lines(text).map((line) => {
    const [value = '', label = '', note = '', tone = ''] = line.split('|').map((s) => s.trim());
    if (!value || !label) throw new Error(`stats line needs "value | label": ${line}`);
    return { value, label, note, tone: TONES.has(tone) ? tone : '' };
  });
  if (!items.length) throw new Error('stats block is empty');
  return items;
}

/** Split "key: value". Reserved keys split on the first colon, data rows on the last. */
function splitKey(line, reserved) {
  const first = line.indexOf(':');
  if (first === -1) return null;
  const key = line.slice(0, first).trim().toLowerCase();
  if (reserved.has(key)) return { key, value: line.slice(first + 1).trim(), reserved: true };
  const last = line.lastIndexOf(':');
  return { key: line.slice(0, last).trim(), value: line.slice(last + 1).trim(), reserved: false };
}

function parseChart(text) {
  const spec = { type: 'bar', unit: '', title: '', caption: '', note: '', labels: 'first', series: [], rows: [] };
  for (const line of lines(text)) {
    const kv = splitKey(line, CHART_KEYS);
    if (!kv) throw new Error(`chart line needs "label: values": ${line}`);
    if (kv.reserved) {
      if (kv.key === 'series') spec.series = kv.value.split(',').map((s) => s.trim()).filter(Boolean);
      else if (kv.key === 'max') spec.max = Number(kv.value);
      else spec[kv.key] = kv.value;
      continue;
    }
    const raw = kv.value.split(',').map((s) => s.trim());
    const values = raw.map((v) => (v === '' || v === '-' ? null : Number(v)));
    if (values.some((v) => v !== null && !Number.isFinite(v))) {
      throw new Error(`chart values must be plain numbers (no thousands separators): ${line}`);
    }
    spec.rows.push({ label: kv.key, raw, values });
  }

  spec.type = spec.type === 'line' ? 'line' : 'bar';
  if (!spec.rows.length) throw new Error('chart has no data rows');
  const width = Math.max(...spec.rows.map((r) => r.values.length));
  if (!spec.series.length) spec.series = Array.from({ length: width }, (_, i) => `Series ${i + 1}`);
  if (spec.series.length > SERIES_COUNT) throw new Error(`chart supports at most ${SERIES_COUNT} series`);
  for (const r of spec.rows) {
    if (r.values.length !== spec.series.length) {
      throw new Error(`row "${r.label}" has ${r.values.length} values for ${spec.series.length} series`);
    }
  }

  const all = spec.rows.flatMap((r) => r.values).filter((v) => v !== null);
  if (!Number.isFinite(spec.max) || spec.max <= 0) {
    spec.max = spec.unit === '%' ? 100 : niceCeil(Math.max(...all, 0));
  }
  return spec;
}

function parseNote(text) {
  const note = { title: '', tone: 'info', body: [] };
  let header = true;
  for (const line of String(text).split('\n')) {
    const kv = header && line.trim() ? splitKey(line.trim(), NOTE_KEYS) : null;
    if (kv?.reserved) {
      note[kv.key] = kv.value;
      continue;
    }
    if (line.trim()) header = false;
    note.body.push(line);
  }
  note.tone = TONES.has(note.tone) ? note.tone : 'info';
  note.body = note.body.join('\n').trim();
  if (!note.body) throw new Error('note block is empty');
  return note;
}

function niceCeil(n) {
  if (n <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(n));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * mag >= n);
  return step * mag;
}

const fmt = (raw, unit) => (raw === '' || raw === '-' || raw == null ? '—' : `${raw}${unit}`);
const pct = (v, max) => Math.max(0, Math.min(100, (v / max) * 100));
const round = (n) => Math.round(n * 100) / 100;

/* ── HTML ─────────────────────────────────────────────────────────── */

function statsHtml(items) {
  const cells = items
    .map(
      (s) => `<div class="stat${s.tone ? ` stat-${s.tone}` : ''}">
  <div class="stat-value">${esc(s.value)}</div>
  <div class="stat-label">${esc(s.label)}</div>
  ${s.note ? `<div class="stat-note">${esc(s.note)}</div>` : ''}
</div>`,
    )
    .join('\n');
  return `<div class="stat-grid" data-count="${items.length}">\n${cells}\n</div>\n`;
}

function legendHtml(spec) {
  return `<ul class="chart-legend" aria-hidden="true">${spec.series
    .map((s, i) => `<li><span class="chart-swatch chart-s${i + 1}"></span>${esc(s)}</li>`)
    .join('')}</ul>`;
}

function dataTableHtml(spec) {
  const head = `<tr><th scope="col">${esc(spec.type === 'line' ? 'Point' : 'Group')}</th>${spec.series
    .map((s) => `<th scope="col">${esc(s)}</th>`)
    .join('')}</tr>`;
  const body = spec.rows
    .map((r) => `<tr><th scope="row">${esc(r.label)}</th>${r.raw.map((v) => `<td>${esc(fmt(v, spec.unit))}</td>`).join('')}</tr>`)
    .join('');
  return `<details class="chart-data"><summary>Show the numbers</summary><table><thead>${head}</thead><tbody>${body}</tbody></table></details>`;
}

function barHtml(spec) {
  const groups = spec.rows
    .map((r) => {
      const bars = r.values
        .map((v, i) => {
          const w = v === null ? 0 : round(pct(v, spec.max));
          return `<div class="bar-row">
      <span class="bar-name">${esc(spec.series[i])}</span>
      <span class="bar-track"><span class="bar-fill chart-s${i + 1}" style="--w:${w}%"></span></span>
      <span class="bar-value">${esc(fmt(r.raw[i], spec.unit))}</span>
    </div>`;
        })
        .join('\n');
      return `<div class="bar-group">
    <div class="bar-group-label">${esc(r.label)}</div>
    ${bars}
  </div>`;
    })
    .join('\n');
  return `<div class="chart-bars" aria-hidden="true">\n${groups}\n</div>`;
}

function lineHtml(spec) {
  const n = spec.rows.length;
  const x = (i) => (n === 1 ? 50 : round((i / (n - 1)) * 100));
  const y = (v) => round(100 - pct(v, spec.max));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * spec.max);

  const grid = ticks
    .map((t) => `<line x1="0" x2="100" y1="${y(t)}" y2="${y(t)}" class="chart-grid" vector-effect="non-scaling-stroke"/>`)
    .join('');
  const yLabels = ticks
    .map((t) => `<span class="chart-ytick" style="top:${y(t)}%">${esc(`${round(t)}${spec.unit}`)}</span>`)
    .join('');

  const lines = [];
  const dots = [];
  // Draw later series first so series 1 (the subject) sits on top.
  for (let s = spec.series.length - 1; s >= 0; s--) {
    const pts = spec.rows
      .map((r, i) => (r.values[s] === null ? null : [x(i), y(r.values[s]), r.raw[s]]))
      .filter(Boolean);
    lines.push(
      `<polyline class="chart-line chart-s${s + 1}" vector-effect="non-scaling-stroke" points="${pts.map((p) => `${p[0]},${p[1]}`).join(' ')}"/>`,
    );
    const labelled = spec.labels === 'all' || (spec.labels === 'first' && s === 0);
    pts.forEach(([px, py, raw], i) => {
      // Labels sit under their point (lines run sideways, so there's room)
      // unless the point is near the floor. End labels hug the plot edge.
      const cls = ['chart-point-label', py > 80 ? 'is-above' : 'is-below'];
      if (i === 0 && px === 0) cls.push('is-start');
      if (i === pts.length - 1 && px === 100) cls.push('is-end');
      dots.push(
        `<span class="chart-dot chart-s${s + 1}" style="left:${px}%;top:${py}%"></span>` +
          (labelled ? `<span class="${cls.join(' ')}" style="left:${px}%;top:${py}%">${esc(fmt(raw, spec.unit))}</span>` : ''),
      );
    });
  }

  const xLabels = spec.rows
    .map((r, i) => `<span class="chart-xtick" style="left:${x(i)}%">${esc(r.label)}</span>`)
    .join('');

  return `<div class="chart-line-wrap" aria-hidden="true">
  <div class="chart-yaxis">${yLabels}</div>
  <div class="chart-plot">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">${grid}${lines.join('')}</svg>
    ${dots.join('')}
  </div>
  <div class="chart-xaxis">${xLabels}</div>
</div>`;
}

function chartHtml(spec) {
  const summary = `${spec.title || 'Chart'}. ${spec.rows
    .map((r) => `${r.label}: ${spec.series.map((s, i) => `${s} ${fmt(r.raw[i], spec.unit)}`).join(', ')}`)
    .join('; ')}.`;
  return `<figure class="chart chart-${spec.type}" role="group" aria-label="${esc(spec.title || 'Chart')}">
  ${spec.title || spec.note ? `<div class="chart-head">${spec.title ? `<div class="chart-title">${esc(spec.title)}</div>` : ''}${spec.note ? `<div class="chart-note">${esc(spec.note)}</div>` : ''}</div>` : ''}
  ${legendHtml(spec)}
  <p class="sr-only">${esc(summary)}</p>
  ${spec.type === 'line' ? lineHtml(spec) : barHtml(spec)}
  ${spec.caption ? `<figcaption>${esc(spec.caption)}</figcaption>` : ''}
  ${dataTableHtml(spec)}
</figure>\n`;
}

function noteHtml(note, markdown) {
  return `<aside class="note note-${note.tone}">
  ${note.title ? `<div class="note-title">${esc(note.title)}</div>` : ''}
  <div class="note-body">${markdown(note.body)}</div>
</aside>\n`;
}

/**
 * Render one block to HTML, or return null if `lang` isn't a block type
 * or the block is malformed (the caller then renders a normal code block).
 */
export function renderBlock(lang, text, { markdown = esc } = {}) {
  if (!BLOCK_LANGS.has(lang)) return null;
  try {
    if (lang === 'stats') return statsHtml(parseStats(text));
    if (lang === 'chart') return chartHtml(parseChart(text));
    if (lang === 'note') return noteHtml(parseNote(text), markdown);
  } catch (err) {
    console.warn(`  ! ${lang} block rendered as code: ${err.message}`);
  }
  return null;
}

/* ── Portable Markdown (cross-posting) ────────────────────────────── */

function blockToMarkdown(lang, text) {
  if (lang === 'stats') {
    return parseStats(text)
      .map((s) => `- **${s.value}** ${s.label}${s.note ? ` (${s.note})` : ''}`)
      .join('\n');
  }
  if (lang === 'chart') {
    const spec = parseChart(text);
    const head = `| ${spec.type === 'line' ? 'Point' : 'Group'} | ${spec.series.join(' | ')} |`;
    const rule = `|---|${spec.series.map(() => '---:').join('|')}|`;
    const rows = spec.rows.map((r) => `| ${r.label} | ${r.raw.map((v) => fmt(v, spec.unit)).join(' | ')} |`);
    return [
      spec.title ? `**${spec.title}**${spec.note ? ` (${spec.note})` : ''}` : '',
      '',
      head,
      rule,
      ...rows,
      spec.caption ? `\n*${spec.caption}*` : '',
    ]
      .join('\n')
      .trim();
  }
  if (lang === 'note') {
    const note = parseNote(text);
    const body = note.title ? `**${note.title}**\n\n${note.body}` : note.body;
    return body.split('\n').map((l) => (l ? `> ${l}` : '>')).join('\n');
  }
  return null;
}

/** Replace every rich block in a Markdown string with plain Markdown. */
export function blocksToMarkdown(md) {
  return String(md).replace(/^```(stats|chart|note)[^\n]*\n([\s\S]*?)^```[ \t]*$/gm, (whole, lang, body) => {
    try {
      return blockToMarkdown(lang, body) ?? whole;
    } catch {
      return whole;
    }
  });
}
