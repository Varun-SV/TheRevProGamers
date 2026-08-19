/** Inline SVG icons — no icon font, no external requests.
 *
 * Every icon declares its own size/fill/stroke on the <svg> root so it
 * renders correctly wherever it's dropped, even in a container that adds
 * no icon-specific CSS. Containers that need a different size (buttons,
 * the icon toggle, etc.) override width/height/stroke-width with a plain
 * CSS rule, which always wins over these presentation attributes.
 */

const stroke = (d, extra = '') =>
  `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;

export const icons = {
  search: stroke('<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.6" y2="16.6"/>'),
  sun: stroke(
    '<circle cx="12" cy="12" r="4.2"/><line x1="12" y1="1.5" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22.5"/><line x1="4.2" y1="4.2" x2="6" y2="6"/><line x1="18" y1="18" x2="19.8" y2="19.8"/><line x1="1.5" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22.5" y2="12"/><line x1="4.2" y1="19.8" x2="6" y2="18"/><line x1="18" y1="6" x2="19.8" y2="4.2"/>'
  ),
  moon: stroke('<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>'),
  menu: stroke('<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>'),
  arrowUp: stroke('<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>'),
  arrowRight: stroke('<line x1="4" y1="12" x2="20" y2="12"/><polyline points="14 6 20 12 14 18"/>'),
  external: stroke('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>'),
  star: stroke('<polygon points="12 2 15.1 8.6 22 9.6 17 14.6 18.2 21.6 12 18.3 5.8 21.6 7 14.6 2 9.6 8.9 8.6"/>'),
  fork: stroke('<circle cx="6" cy="4" r="2.2"/><circle cx="18" cy="4" r="2.2"/><circle cx="12" cy="20" r="2.2"/><path d="M6 6.2v3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-3"/><line x1="12" y1="12.2" x2="12" y2="17.8"/>'),
  play: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="none" aria-hidden="true"><polygon points="6 3 21 12 6 21"/></svg>',
  rss: stroke('<path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1.6" fill="currentColor" stroke="none"/>'),
  coffee: stroke('<path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/><line x1="6" y1="1.5" x2="6" y2="4.5"/><line x1="10" y1="1.5" x2="10" y2="4.5"/><line x1="14" y1="1.5" x2="14" y2="4.5"/>'),
  heart: stroke('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.7 1.1-1a5.5 5.5 0 0 0 0-7.7z"/>'),
  code: stroke('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'),
  clock: stroke('<circle cx="12" cy="12" r="9"/><polyline points="12 6.5 12 12 15.5 14"/>'),
};

/** Brand marks (filled paths, 24x24). */
export const brandIcons = {
  youtube:
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="none" aria-hidden="true"><path d="M23 12s0-3.9-.5-5.7c-.3-1-1.1-1.9-2.1-2.1C18.6 3.7 12 3.7 12 3.7s-6.6 0-8.4.5c-1 .3-1.8 1.1-2.1 2.1C1 8.1 1 12 1 12s0 3.9.5 5.7c.3 1 1.1 1.9 2.1 2.1 1.8.5 8.4.5 8.4.5s6.6 0 8.4-.5c1-.3 1.8-1.1 2.1-2.1.5-1.8.5-5.7.5-5.7zM9.8 15.5v-7l6.3 3.5z"/></svg>',
  github:
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="none" aria-hidden="true"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.2-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.4 11.4 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1.8.9 1.2 1.9 1.2 3.2 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .4.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z"/></svg>',
  patreon:
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="none" aria-hidden="true"><path d="M15.4 2.1c-4.2 0-7.6 3.4-7.6 7.6 0 4.2 3.4 7.6 7.6 7.6 4.2 0 7.6-3.4 7.6-7.6 0-4.2-3.4-7.6-7.6-7.6zM1 22.1h3.7V2.1H1z"/></svg>',
  bmc:
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="none" aria-hidden="true"><path d="M20.2 6.6c-.2-.9-.9-1.4-1.8-1.6-1.5-.3-3-.4-4.5-.4-1.7 0-3.4.1-5.1.3-.6.1-1.2.1-1.8.2-.7.1-1.3.4-1.6 1-.3.6-.3 1.3-.1 1.9.2.6.7 1 1.3 1.1l.2.1 1.3 8.5c.1.7.3 1.4.8 1.9.6.6 1.4.8 2.2.9 1 .1 2 .1 3 .1s2 0 3-.2c.8-.1 1.5-.4 2-1s.7-1.3.8-2l1.2-8.3c.7-.2 1.2-.7 1.4-1.4.1-.4.1-.7 0-1.1zM9.9 16.9c-.5.2-1 .3-1.5.2l-.7-4.6c.9.3 1.9.5 2.9.5 1.3 0 2.6-.3 3.8-.7.4-.1.8-.3 1.2-.4l-.6 3.9c-1.6.6-3.3 1-5.1 1.1z"/></svg>',
  mail: stroke('<rect x="2.5" y="4.5" width="19" height="15" rx="2"/><polyline points="3 6 12 13 21 6"/>'),
};

export default icons;
