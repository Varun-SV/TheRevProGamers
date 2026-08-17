/**
 * Patreon integration (API v2 — read only).
 *
 * Patreon's public API has no endpoint for creating posts; `campaigns.posts`
 * is a read scope and the only write scope is `w:campaigns.webhook`. So this
 * module pulls campaign, tier and patron data *from* Patreon onto the site.
 * Publishing to Patreon is handled by scripts/crosspost.mjs.
 *
 * Secrets used: PATREON_ACCESS_TOKEN (required), PATREON_CAMPAIGN_ID (optional)
 *
 * Privacy note: this module reads campaign and tier data plus the aggregate
 * patron count only. Individual member records are never requested, so no
 * patron name, avatar or email reaches disk.
 */

import { config } from '../lib/config.mjs';
import { getJson } from '../lib/http.mjs';

const API = 'https://www.patreon.com/api/oauth2/v2';

const auth = () => ({ Authorization: `Bearer ${config.patreonAccessToken}` });

/** Index a JSON:API `included` array by "type:id" for relationship lookups. */
function indexIncluded(included = []) {
  const map = new Map();
  for (const item of included) map.set(`${item.type}:${item.id}`, item);
  return map;
}

async function fetchCampaign() {
  const params = new URLSearchParams({
    include: 'tiers',
    'fields[campaign]':
      'creation_name,patron_count,pledge_sum,summary,url,image_url,is_monthly,published_at',
    'fields[tier]':
      'title,amount_cents,description,patron_count,image_url,published,url,requires_shipping',
  });

  const { ok, data, error } = await getJson(`${API}/campaigns?${params}`, { headers: auth() });
  if (!ok) return { ok: false, error };

  const campaign = data?.data?.[0];
  if (!campaign) return { ok: false, error: 'no campaign on this account' };

  const included = indexIncluded(data.included);
  const tierRefs = campaign.relationships?.tiers?.data || [];

  const tiers = tierRefs
    .map((ref) => included.get(`${ref.type}:${ref.id}`))
    .filter(Boolean)
    .filter((t) => t.attributes?.published !== false)
    .map((t) => ({
      id: t.id,
      title: t.attributes?.title || '',
      amountCents: t.attributes?.amount_cents ?? 0,
      amountDisplay:
        typeof t.attributes?.amount_cents === 'number'
          ? `$${(t.attributes.amount_cents / 100).toFixed(2).replace(/\.00$/, '')}`
          : '',
      description: (t.attributes?.description || '').replace(/<[^>]+>/g, '').trim(),
      patronCount: t.attributes?.patron_count ?? null,
      image: t.attributes?.image_url || '',
      url: t.attributes?.url || config.patreonUrl,
    }))
    .sort((a, b) => a.amountCents - b.amountCents);

  return {
    ok: true,
    campaign: {
      id: campaign.id,
      name: campaign.attributes?.creation_name || '',
      summary: (campaign.attributes?.summary || '').replace(/<[^>]+>/g, '').trim(),
      url: campaign.attributes?.url || config.patreonUrl,
      image: campaign.attributes?.image_url || '',
      patronCount: campaign.attributes?.patron_count ?? null,
    },
    tiers,
  };
}

export async function fetchPatreon() {
  const empty = {
    ok: false,
    configured: Boolean(config.patreonAccessToken),
    url: config.patreonUrl,
    campaign: null,
    tiers: [],
    patronCount: null,
    error: '',
  };

  if (!config.patreonAccessToken) {
    return { ...empty, error: 'PATREON_ACCESS_TOKEN not set — showing the join link only.' };
  }

  const camp = await fetchCampaign();
  if (!camp.ok) return { ...empty, error: camp.error };

  return {
    ok: true,
    configured: true,
    url: camp.campaign.url || config.patreonUrl,
    campaign: camp.campaign,
    tiers: camp.tiers,
    // Only the aggregate count — individual patron names are never fetched.
    patronCount: camp.campaign.patronCount,
    error: '',
  };
}

export default fetchPatreon;
