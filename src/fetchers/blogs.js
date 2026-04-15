import Parser from 'rss-parser';
import { RSS_FEEDS } from '../config.js';

const parser = new Parser();

export async function fetchBlogs() {
  const items = [];
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

  for (const feed of RSS_FEEDS) {
    try {
      const data = await parser.parseURL(feed.url);
      for (const entry of (data.items || [])) {
        const pubDate = entry.pubDate ? new Date(entry.pubDate) : null;
        if (pubDate && pubDate.getTime() < oneDayAgo) continue;

        items.push({
          source: 'blogs',
          title: entry.title || '',
          url: entry.link || '',
          description: (entry.contentSnippet || entry.content || '').slice(0, 300),
          metadata: { feedName: feed.name, author: entry.creator || entry.author || '' },
          timestamp: pubDate?.toISOString() || new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn(`[blogs] Failed to fetch ${feed.name}: ${err.message}`);
    }
  }

  return items;
}
