import { YOUTUBE_KEYWORDS } from '../config.js';

export async function fetchYouTube() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn('[youtube] YOUTUBE_API_KEY not set, skipping');
    return [];
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const items = [];

  for (const keyword of YOUTUBE_KEYWORDS) {
    const params = new URLSearchParams({
      part: 'snippet',
      q: keyword,
      type: 'video',
      publishedAfter: since,
      order: 'viewCount',
      maxResults: '10',
      key: apiKey,
    });

    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
    if (!res.ok) continue;
    const data = await res.json();

    for (const item of (data.items || [])) {
      items.push({
        source: 'youtube',
        title: item.snippet.title,
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        description: item.snippet.description || '',
        metadata: { channel: item.snippet.channelTitle, thumbnail: item.snippet.thumbnails?.medium?.url },
        timestamp: item.snippet.publishedAt,
      });
    }
  }

  const seen = new Set();
  return items.filter(item => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}
