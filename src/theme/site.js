/* TheRevProGamers — client runtime.
   Deliberately small and dependency-free: markdown and syntax highlighting
   are done at build time, so this only handles interaction. */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /* ── Theme ──────────────────────────────────────────────────────── */
  const THEME_KEY = 'trpg-theme';

  function setTheme(theme, persist = true) {
    document.documentElement.setAttribute('data-theme', theme);
    if (persist) {
      try { localStorage.setItem(THEME_KEY, theme); } catch { /* private mode */ }
    }
    const btn = $('#themeToggle');
    if (btn) {
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      const sun = $('#iconSun', btn);
      const moon = $('#iconMoon', btn);
      if (sun && moon) {
        sun.style.display = theme === 'dark' ? 'none' : '';
        moon.style.display = theme === 'dark' ? '' : 'none';
      }
    }
  }

  function initTheme() {
    let stored = null;
    try { stored = localStorage.getItem(THEME_KEY); } catch { /* ignore */ }
    const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches;
    setTheme(stored || (prefersLight ? 'light' : 'dark'), false);

    $('#themeToggle')?.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      setTheme(next);
    });
  }

  /* ── Mobile nav ─────────────────────────────────────────────────── */
  function initNav() {
    const toggle = $('#navToggle');
    const nav = $('#siteNav');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });

    nav.addEventListener('click', (e) => {
      if (e.target.closest('a')) {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ── Reading progress + scroll-to-top ───────────────────────────── */
  function initScroll() {
    const bar = $('#progress');
    const top = $('#toTop');
    if (!bar && !top) return;

    let ticking = false;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
      if (bar) bar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
      if (top) top.classList.toggle('show', window.scrollY > 700);
      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });

    top?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    update();
  }

  /* ── Code copy buttons ──────────────────────────────────────────── */
  function initCopy() {
    $$('.prose pre').forEach((pre) => {
      if ($('.copy-btn', pre)) return;
      const btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.type = 'button';
      btn.textContent = 'Copy';
      btn.addEventListener('click', async () => {
        const code = $('code', pre)?.innerText ?? pre.innerText;
        try {
          await navigator.clipboard.writeText(code);
        } catch {
          // Clipboard API needs a secure context; fall back to a temp textarea.
          const ta = document.createElement('textarea');
          ta.value = code;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); } catch { /* give up quietly */ }
          ta.remove();
        }
        btn.textContent = 'Copied';
        btn.classList.add('done');
        setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('done'); }, 1800);
      });
      pre.appendChild(btn);
    });
  }

  /* ── Table of contents scrollspy ────────────────────────────────── */
  function initToc() {
    const links = $$('.toc-list a');
    if (!links.length) return;

    const byId = new Map();
    const targets = [];
    for (const link of links) {
      const id = decodeURIComponent(link.getAttribute('href') || '').slice(1);
      const el = id && document.getElementById(id);
      if (el) { byId.set(el, link); targets.push(el); }
    }
    if (!targets.length) return;

    let active = null;
    const setActive = (link) => {
      if (active === link) return;
      active?.classList.remove('active');
      link?.classList.add('active');
      active = link;
    };

    // Pick the last heading whose top has passed the reading line.
    let ticking = false;
    const update = () => {
      const line = window.scrollY + 130;
      let current = targets[0];
      for (const t of targets) {
        if (t.getBoundingClientRect().top + window.scrollY <= line) current = t;
        else break;
      }
      setActive(byId.get(current));
      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  }

  /* ── Wide tables get their own scroll container ─────────────────── */
  function initTables() {
    $$('.prose table').forEach((table) => {
      if (table.parentElement?.classList.contains('table-scroll')) return;
      const wrap = document.createElement('div');
      wrap.className = 'table-scroll';
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    });
  }

  /* ── Search palette ─────────────────────────────────────────────── */
  function initSearch() {
    const overlay = $('#cmdOverlay');
    const input = $('#cmdInput');
    const results = $('#cmdResults');
    if (!overlay || !input || !results) return;

    let index = null;
    let loading = false;
    let selected = 0;

    async function ensureIndex() {
      if (index || loading) return;
      loading = true;
      try {
        const res = await fetch('/search-index.json', { cache: 'no-cache' });
        index = res.ok ? await res.json() : [];
      } catch {
        index = [];
      }
      loading = false;
    }

    const escapeHtml = (s = '') =>
      String(s).replace(/[&<>"']/g, (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

    function score(entry, q) {
      const title = entry.title.toLowerCase();
      if (title === q) return 100;
      if (title.startsWith(q)) return 80;
      if (title.includes(q)) return 60;
      if ((entry.tags || []).some((t) => t.toLowerCase().includes(q))) return 40;
      if ((entry.description || '').toLowerCase().includes(q)) return 25;
      if ((entry.body || '').toLowerCase().includes(q)) return 10;
      return 0;
    }

    function render(list) {
      if (!list.length) {
        results.innerHTML = '<div class="cmd-empty">Nothing found. Try a different word.</div>';
        return;
      }
      results.innerHTML = list
        .map(
          (e, i) => `<a class="cmd-item${i === selected ? ' sel' : ''}" href="${escapeHtml(e.url)}">
            <div class="cmd-item-title">${escapeHtml(e.title)}</div>
            <div class="cmd-item-meta">${escapeHtml(e.kind || 'Post')}${e.date ? ` · ${escapeHtml(e.date)}` : ''}</div>
          </a>`
        )
        .join('');
    }

    async function search() {
      await ensureIndex();
      const q = input.value.trim().toLowerCase();
      selected = 0;
      if (!q) {
        render((index || []).slice(0, 8));
        return;
      }
      const hits = (index || [])
        .map((e) => ({ e, s: score(e, q) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 10)
        .map((x) => x.e);
      render(hits);
    }

    function open() {
      overlay.classList.add('open');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      input.value = '';
      input.focus();
      search();
    }

    function close() {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    $('#searchTrigger')?.addEventListener('click', open);
    input.addEventListener('input', search);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    document.addEventListener('keydown', (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;

      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        overlay.classList.contains('open') ? close() : open();
        return;
      }
      if (!overlay.classList.contains('open')) return;

      if (e.key === 'Escape') { close(); return; }

      const items = $$('.cmd-item', results);
      if (!items.length) return;

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        selected = e.key === 'ArrowDown'
          ? (selected + 1) % items.length
          : (selected - 1 + items.length) % items.length;
        items.forEach((it, i) => it.classList.toggle('sel', i === selected));
        items[selected].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        items[selected]?.click();
      }
    });
  }

  /* ── Live data hydration (Railway / server deployments only) ────── */
  async function hydrateLive() {
    const slots = $$('[data-live]');
    if (!slots.length) return;

    try {
      const res = await fetch('/api/stats', { cache: 'no-cache' });
      // On static hosting there is no /api, so a 404 here is the normal path.
      if (!res.ok) return;
      const stats = await res.json();

      for (const el of slots) {
        const key = el.dataset.live;
        const value = key.split('.').reduce((o, k) => (o == null ? o : o[k]), stats);
        if (value != null && String(value) !== '') el.textContent = String(value);
      }
    } catch {
      /* static host — build-time values stay */
    }
  }

  /* ── Boot ───────────────────────────────────────────────────────── */
  function init() {
    initTheme();
    initNav();
    initScroll();
    initCopy();
    initToc();
    initTables();
    initSearch();
    hydrateLive();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
