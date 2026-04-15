import { TWITTER_KEYWORDS } from '../config.js';

export async function fetchTwitter() {
  const token = process.env.TWITTER_BEARER_TOKEN;
  if (!token) {
    console.warn('[twitter] TWITTER_BEARER_TOKEN not set, skipping');
    return [];
  }

  const items = [];
  const query = TWITTER_KEYWORDS.map(k => `"${k}"`).join(' OR ');
  const params = new URLSearchParams({
    query,
    max_results: '20',
    'tweet.fields': 'created_at,public_metrics,author_id',
    expansions: 'author_id',
  });

  const res = await fetch(`https://api.twitter.com/2/tweets/search/recent?${params}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!res.ok) {
    console.warn(`[twitter] API returned ${res.status}, skipping`);
    return [];
  }

  const data = await res.json();
  const users = Object.fromEntries(
    (data.includes?.users || []).map(u => [u.id, u.username])
  );

  for (const tweet of (data.data || [])) {
    const author = users[tweet.author_id] || 'unknown';
    items.push({
      source: 'twitter',
      title: tweet.text.slice(0, 120),
      url: `https://x.com/${author}/status/${tweet.id}`,
      description: tweet.text,
      metadata: {
        author,
        likes: tweet.public_metrics?.like_count || 0,
        retweets: tweet.public_metrics?.retweet_count || 0,
      },
      timestamp: tweet.created_at,
    });
  }

  return items;
}
