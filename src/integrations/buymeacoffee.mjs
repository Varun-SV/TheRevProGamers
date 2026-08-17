/**
 * Buy Me a Coffee integration (API v1 — read only).
 *
 * The BMC developer API exposes three GET collections: supporters (one-off
 * tips), subscriptions (recurring members) and extras (product purchases).
 * There is no write endpoint, so publishing a post to BMC is handled by
 * scripts/crosspost.mjs instead.
 *
 * Secrets used: BMC_ACCESS_TOKEN
 */

import { config } from '../lib/config.mjs';
import { getJson } from '../lib/http.mjs';

const API = 'https://developers.buymeacoffee.com/api/v1';

const auth = () => ({ Authorization: `Bearer ${config.bmcAccessToken}` });

/** BMC paginates with `next_page_url`; walk it up to `maxPages`. */
async function fetchAll(endpoint, maxPages = 3) {
  const rows = [];
  let url = `${API}/${endpoint}`;
  let error = null;

  for (let page = 0; page < maxPages && url; page++) {
    const { ok, data, error: e } = await getJson(url, { headers: auth() });
    if (!ok) {
      error = e;
      break;
    }
    const batch = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    rows.push(...batch);
    url = data?.next_page_url || null;
  }
  return { rows, error };
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export async function fetchBuyMeACoffee({ limit = config.supporterLimit } = {}) {
  const empty = {
    ok: false,
    configured: Boolean(config.bmcAccessToken),
    url: config.bmcUrl,
    username: config.bmcUsername,
    supporters: [],
    members: [],
    extras: [],
    totals: { supporters: 0, members: 0, coffees: 0 },
    error: '',
  };

  if (!config.bmcAccessToken) {
    return { ...empty, error: 'BMC_ACCESS_TOKEN not set — showing the support link only.' };
  }

  const [oneOff, subs, extras] = await Promise.all([
    fetchAll('supporters'),
    fetchAll('subscriptions?status=active'),
    fetchAll('extras', 1),
  ]);

  if (oneOff.error && subs.error) {
    return { ...empty, error: oneOff.error || subs.error };
  }

  const supporters = oneOff.rows
    .map((s) => ({
      name: s.payer_name || s.supporter_name || 'Someone',
      message: config.showSupporterMessages ? (s.support_note || '').trim() : '',
      coffees: num(s.support_coffees) || 1,
      currency: s.support_currency || 'USD',
      amount: num(s.support_coffees) * num(s.support_coffee_price),
      date: s.support_created_on || s.created_on || '',
      isPrivate: s.support_visibility === 0,
    }))
    .filter((s) => !s.isPrivate)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const members = subs.rows
    .map((m) => ({
      name: m.payer_name || m.supporter_name || 'A member',
      message: config.showSupporterMessages ? (m.subscription_message || '').trim() : '',
      level: m.subscription_coffee_num ? `${m.subscription_coffee_num}x` : '',
      amount: num(m.subscription_coffee_price) * num(m.subscription_coffee_num || 1),
      currency: m.subscription_currency || 'USD',
      since: m.subscription_created_on || '',
      isPrivate: m.subscription_is_cancelled === 1,
    }))
    .filter((m) => !m.isPrivate);

  const anonymise = (list) =>
    config.showSupporterNames ? list : list.map((x) => ({ ...x, name: 'Anonymous', message: '' }));

  return {
    ok: true,
    configured: true,
    url: config.bmcUrl,
    username: config.bmcUsername,
    supporters: anonymise(supporters).slice(0, limit),
    members: anonymise(members).slice(0, limit),
    extras: extras.rows.slice(0, 20).map((e) => ({
      title: e.extra_title || e.title || '',
      description: (e.extra_description || '').slice(0, 200),
      price: num(e.extra_price),
      currency: e.extra_currency || 'USD',
      url: e.extra_url || config.bmcUrl,
    })),
    totals: {
      supporters: supporters.length,
      members: members.length,
      coffees: supporters.reduce((sum, s) => sum + s.coffees, 0),
    },
    error: oneOff.error || subs.error || '',
  };
}

export default fetchBuyMeACoffee;
