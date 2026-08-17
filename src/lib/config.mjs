/**
 * Central configuration.
 *
 * Every value resolves in this order:
 *   1. Environment variable  (GitHub Secrets / Railway variables)
 *   2. content/data/site.json (committed, safe-to-share defaults)
 *   3. The hardcoded fallback below
 *
 * Nothing here throws when a secret is missing. Missing secrets simply
 * disable the integration that needs them and the site builds anyway.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function readSiteJson() {
  const p = path.join(ROOT, 'content/data/site.json');
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
}

const siteJson = readSiteJson();

/** Read a value from env, then site.json, then the given fallback. */
function val(envKey, jsonPath, fallback = '') {
  const fromEnv = process.env[envKey];
  if (fromEnv != null && String(fromEnv).trim() !== '') return String(fromEnv).trim();

  if (jsonPath) {
    const found = jsonPath.split('.').reduce((o, k) => (o == null ? o : o[k]), siteJson);
    if (found != null && String(found).trim() !== '') return found;
  }
  return fallback;
}

/** Truthy check for optional secrets. */
const has = (v) => typeof v === 'string' && v.trim() !== '';

export const config = {
  // ── Identity / branding ────────────────────────────────────────────
  siteName: val('SITE_NAME', 'siteName', 'TheRevProGamers'),
  siteTagline: val('SITE_TAGLINE', 'siteTagline', 'Games, gear, and things I build.'),
  siteDescription: val(
    'SITE_DESCRIPTION',
    'siteDescription',
    'Tech reviews, project write-ups, build guides and videos from TheRevProGamers.'
  ),
  siteUrl: val('SITE_URL', 'siteUrl', 'https://therevprogamers.com').replace(/\/+$/, ''),
  authorName: val('AUTHOR_NAME', 'authorName', 'Varun SV'),
  authorBio: val(
    'AUTHOR_BIO',
    'authorBio',
    'I build things, break hardware on purpose, and write down what I learned.'
  ),
  authorAvatar: val('AUTHOR_AVATAR', 'authorAvatar', ''),
  contactEmail: val('CONTACT_EMAIL', 'contactEmail', ''),

  // ── Social / platform handles ──────────────────────────────────────
  youtubeHandle: val('YOUTUBE_HANDLE', 'social.youtubeHandle', '@therevprogamers'),
  youtubeChannelId: val('YOUTUBE_CHANNEL_ID', 'social.youtubeChannelId', ''),
  patreonUrl: val('PATREON_URL', 'social.patreonUrl', 'https://www.patreon.com/cw/VarunSV'),
  bmcUrl: val('BMC_URL', 'social.bmcUrl', 'https://buymeacoffee.com/varunsv'),
  bmcUsername: val('BMC_USERNAME', 'social.bmcUsername', 'varunsv'),
  githubUsername: val('GH_USERNAME', 'social.githubUsername', 'Varun-SV'),
  twitterHandle: val('TWITTER_HANDLE', 'social.twitterHandle', ''),
  instagramHandle: val('INSTAGRAM_HANDLE', 'social.instagramHandle', ''),
  discordInvite: val('DISCORD_INVITE', 'social.discordInvite', ''),

  // ── Read-side API credentials (all optional) ───────────────────────
  youtubeApiKey: val('YOUTUBE_API_KEY'),
  patreonAccessToken: val('PATREON_ACCESS_TOKEN'),
  patreonCampaignId: val('PATREON_CAMPAIGN_ID'),
  bmcAccessToken: val('BMC_ACCESS_TOKEN'),
  githubToken: val('GH_API_TOKEN') || val('GITHUB_TOKEN'),

  // ── Affiliate ──────────────────────────────────────────────────────
  amazonTag: val('AMAZON_ASSOCIATE_TAG', 'affiliate.amazonTag', ''),
  affiliateDisclosure: val(
    'AFFILIATE_DISCLOSURE',
    'affiliate.disclosure',
    'Some links on this page are affiliate links. If you buy through them I may earn a small commission at no extra cost to you. It never changes what I recommend.'
  ),

  // ── Write-side / cross-posting credentials (all optional) ──────────
  discordWebhookUrl: val('DISCORD_WEBHOOK_URL'),
  telegramBotToken: val('TELEGRAM_BOT_TOKEN'),
  telegramChatId: val('TELEGRAM_CHAT_ID'),
  mastodonInstanceUrl: val('MASTODON_INSTANCE_URL').replace(/\/+$/, ''),
  mastodonAccessToken: val('MASTODON_ACCESS_TOKEN'),
  devtoApiKey: val('DEVTO_API_KEY'),

  // ── Behaviour switches ─────────────────────────────────────────────
  /** Show supporter display names on the public supporters wall. */
  showSupporterNames: val('SHOW_SUPPORTER_NAMES', 'privacy.showSupporterNames', 'true') !== 'false',
  /** Show the message a supporter left with their tip. */
  showSupporterMessages:
    val('SHOW_SUPPORTER_MESSAGES', 'privacy.showSupporterMessages', 'true') !== 'false',
  /** Max supporters rendered on the wall. */
  supporterLimit: Number(val('SUPPORTER_LIMIT', 'privacy.supporterLimit', '60')) || 60,
};

/** Which integrations have the credentials they need. */
export const enabled = {
  youtube: has(config.youtubeChannelId) || has(config.youtubeApiKey),
  youtubeRich: has(config.youtubeApiKey),
  patreon: has(config.patreonAccessToken),
  bmc: has(config.bmcAccessToken),
  github: has(config.githubUsername),
  discord: has(config.discordWebhookUrl),
  telegram: has(config.telegramBotToken) && has(config.telegramChatId),
  mastodon: has(config.mastodonInstanceUrl) && has(config.mastodonAccessToken),
  devto: has(config.devtoApiKey),
};

export const nav = siteJson.nav || [
  { label: 'Home', href: '/' },
  { label: 'Blog', href: '/blog/' },
  { label: 'Reviews', href: '/reviews/' },
  { label: 'Projects', href: '/projects/' },
  { label: 'Videos', href: '/videos/' },
  { label: 'Gear', href: '/gear/' },
  { label: 'Support', href: '/support/' },
  { label: 'About', href: '/about/' },
];

export default config;
