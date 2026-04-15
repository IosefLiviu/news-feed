import Parser from 'rss-parser';
import { PRODUCTHUNT_KEYWORDS } from '../config.js';

const parser = new Parser();

export async function fetchProductHunt() {
  const items = [];

  try {
    const feed = await parser.parseURL('https://www.producthunt.com/feed');

    for (const entry of (feed.items || [])) {
      const text = `${entry.title} ${entry.contentSnippet || ''}`.toLowerCase();
      const matches = PRODUCTHUNT_KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
      if (!matches) continue;

      items.push({
        source: 'producthunt',
        title: entry.title || '',
        url: entry.link || '',
        description: (entry.contentSnippet || '').slice(0, 300),
        metadata: {},
        timestamp: entry.pubDate ? new Date(entry.pubDate).toISOString() : new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn(`[producthunt] Failed to fetch: ${err.message}`);
  }

  return items;
}
