/**
 * YouTube integration.
 *
 * Three tiers, best available wins:
 *   1. YOUTUBE_API_KEY + channel id  -> full data (views, duration, description)
 *   2. channel id only               -> public RSS feed (title, thumb, date)
 *   3. handle only                   -> scrape the channel page for its id, then (2)
 *
 * Secrets used: YOUTUBE_API_KEY (optional), YOUTUBE_CHANNEL_ID, YOUTUBE_HANDLE
 */

import { config } from '../lib/config.mjs';
import { getJson, getText } from '../lib/http.mjs';

const API = 'https://www.googleapis.com/youtube/v3';

/** Resolve an @handle to a UC... channel id by reading the public channel page. */
export async function resolveChannelId(handle = config.youtubeHandle) {
  if (!handle) return null;
  const clean = String(handle).replace(/^@/, '');

  const { ok, data } = await getText(`https://www.youtube.com/@${encodeURIComponent(clean)}`);
  if (!ok || !data) return null;

  const patterns = [
    /"channelId":"(UC[\w-]{22})"/,
    /channel\/(UC[\w-]{22})/,
    /"externalId":"(UC[\w-]{22})"/,
  ];
  for (const re of patterns) {
    const m = data.match(re);
    if (m) return m[1];
  }
  return null;
}

/** ISO-8601 duration (PT1H2M3S) -> "1:02:03" */
function humanDuration(iso) {
  if (!iso) return '';
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '';
  const [h, min, s] = [Number(m[1] || 0), Number(m[2] || 0), Number(m[3] || 0)];
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(min)}:${pad(s)}` : `${min}:${pad(s)}`;
}

function compactNumber(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '';
  if (num >= 1e6) return `${(num / 1e6).toFixed(num >= 1e7 ? 0 : 1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(num >= 1e4 ? 0 : 1)}K`;
  return String(num);
}

async function fetchViaApi(channelId, limit) {
  const chan = await getJson(
    `${API}/channels?part=contentDetails,snippet,statistics&id=${channelId}&key=${config.youtubeApiKey}`
  );
  if (!chan.ok) return { ok: false, error: chan.error };

  const channel = chan.data?.items?.[0];
  if (!channel) return { ok: false, error: 'channel not found' };

  const uploads = channel.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) return { ok: false, error: 'no uploads playlist' };

  const pl = await getJson(
    `${API}/playlistItems?part=snippet,contentDetails&playlistId=${uploads}&maxResults=${limit}&key=${config.youtubeApiKey}`
  );
  if (!pl.ok) return { ok: false, error: pl.error };

  const ids = (pl.data.items || []).map((i) => i.contentDetails?.videoId).filter(Boolean);
  let stats = {};
  if (ids.length) {
    const st = await getJson(
      `${API}/videos?part=statistics,contentDetails&id=${ids.join(',')}&key=${config.youtubeApiKey}`
    );
    if (st.ok) {
      for (const v of st.data.items || []) stats[v.id] = v;
    }
  }

  const videos = (pl.data.items || []).map((item) => {
    const id = item.contentDetails?.videoId;
    const sn = item.snippet || {};
    const extra = stats[id] || {};
    const thumbs = sn.thumbnails || {};
    return {
      id,
      title: sn.title || '',
      description: (sn.description || '').slice(0, 300),
      publishedAt: item.contentDetails?.videoPublishedAt || sn.publishedAt || '',
      url: `https://www.youtube.com/watch?v=${id}`,
      thumbnail:
        thumbs.maxres?.url || thumbs.standard?.url || thumbs.high?.url || thumbs.medium?.url || '',
      views: extra.statistics?.viewCount ? Number(extra.statistics.viewCount) : null,
      viewsDisplay: compactNumber(extra.statistics?.viewCount),
      likes: extra.statistics?.likeCount ? Number(extra.statistics.likeCount) : null,
      duration: humanDuration(extra.contentDetails?.duration),
    };
  });

  return {
    ok: true,
    channel: {
      id: channelId,
      title: channel.snippet?.title || config.siteName,
      handle: config.youtubeHandle,
      url: `https://www.youtube.com/${config.youtubeHandle}`,
      thumbnail: channel.snippet?.thumbnails?.high?.url || '',
      subscribers: channel.statistics?.subscriberCount
        ? Number(channel.statistics.subscriberCount)
        : null,
      subscribersDisplay: compactNumber(channel.statistics?.subscriberCount),
      videoCount: channel.statistics?.videoCount ? Number(channel.statistics.videoCount) : null,
    },
    videos,
  };
}

async function fetchViaRss(channelId, limit) {
  const { ok, data, error } = await getText(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
  );
  if (!ok) return { ok: false, error };

  const entries = data.split('<entry>').slice(1);
  const pick = (block, tag) => {
    const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
    return m ? m[1].trim() : '';
  };
  const unescapeXml = (s) =>
    s
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');

  const videos = entries.slice(0, limit).map((block) => {
    const id = pick(block, 'yt:videoId');
    return {
      id,
      title: unescapeXml(pick(block, 'title')),
      description: unescapeXml(pick(block, 'media:description')).slice(0, 300),
      publishedAt: pick(block, 'published'),
      url: `https://www.youtube.com/watch?v=${id}`,
      thumbnail: id ? `https://i.ytimg.com/vi/${id}/maxresdefault.jpg` : '',
      views: null,
      viewsDisplay: '',
      likes: null,
      duration: '',
    };
  });

  const channelTitle = unescapeXml((data.match(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>/) || [])[1] || '');

  return {
    ok: true,
    channel: {
      id: channelId,
      title: channelTitle || config.siteName,
      handle: config.youtubeHandle,
      url: `https://www.youtube.com/${config.youtubeHandle}`,
      thumbnail: '',
      subscribers: null,
      subscribersDisplay: '',
      videoCount: null,
    },
    videos,
  };
}

export async function fetchYouTube({ limit = 12 } = {}) {
  const empty = {
    ok: false,
    source: 'none',
    channel: {
      id: '',
      title: config.siteName,
      handle: config.youtubeHandle,
      url: `https://www.youtube.com/${config.youtubeHandle}`,
      thumbnail: '',
      subscribers: null,
      subscribersDisplay: '',
      videoCount: null,
    },
    videos: [],
    error: '',
  };

  let channelId = config.youtubeChannelId;
  if (!channelId) {
    channelId = await resolveChannelId();
    if (channelId) console.log(`  · resolved ${config.youtubeHandle} -> ${channelId}`);
  }

  if (!channelId) {
    return { ...empty, error: 'No YOUTUBE_CHANNEL_ID set and the handle could not be resolved.' };
  }

  if (config.youtubeApiKey) {
    const viaApi = await fetchViaApi(channelId, limit);
    if (viaApi.ok) return { ...viaApi, source: 'api', error: '' };
    console.warn(`  ! YouTube API failed (${viaApi.error}); falling back to RSS`);
  }

  const viaRss = await fetchViaRss(channelId, limit);
  if (viaRss.ok) return { ...viaRss, source: 'rss', error: '' };

  return { ...empty, channel: { ...empty.channel, id: channelId }, error: viaRss.error };
}

export default fetchYouTube;
