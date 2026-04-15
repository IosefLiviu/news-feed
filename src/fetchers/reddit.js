import { REDDIT_SUBREDDITS } from '../config.js';

export async function fetchReddit() {
  const items = [];
  const oneDayAgo = Date.now() / 1000 - 24 * 60 * 60;

  for (const sub of REDDIT_SUBREDDITS) {
    const url = `https://www.reddit.com/r/${sub}/top.json?t=day&limit=10`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ClaudeCodeDaily/1.0' },
    });

    if (!res.ok) continue;
    const data = await res.json();

    for (const post of (data.data?.children || [])) {
      const d = post.data;
      if (d.created_utc < oneDayAgo) continue;

      items.push({
        source: 'reddit',
        title: d.title,
        url: `https://www.reddit.com${d.permalink}`,
        description: (d.selftext || '').slice(0, 300),
        metadata: { subreddit: d.subreddit, score: d.score, comments: d.num_comments },
        timestamp: new Date(d.created_utc * 1000).toISOString(),
      });
    }
  }

  return items;
}
