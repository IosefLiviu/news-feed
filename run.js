import { fetchGitHub } from './src/fetchers/github.js';
import { fetchYouTube } from './src/fetchers/youtube.js';
import { fetchTwitter } from './src/fetchers/twitter.js';
import { fetchReddit } from './src/fetchers/reddit.js';
import { fetchBlogs } from './src/fetchers/blogs.js';
import { fetchProductHunt } from './src/fetchers/producthunt.js';
import { curateItems } from './src/curate.js';
import { buildDashboard } from './src/build.js';

async function main() {
  console.log('[run] Starting daily feed pipeline...');

  // Fetch from all sources in parallel
  const results = await Promise.allSettled([
    fetchGitHub(),
    fetchYouTube(),
    fetchTwitter(),
    fetchReddit(),
    fetchBlogs(),
    fetchProductHunt(),
  ]);

  const sourceNames = ['GitHub', 'YouTube', 'Twitter', 'Reddit', 'Blogs', 'ProductHunt'];
  const allItems = [];

  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'fulfilled') {
      const items = results[i].value;
      console.log(`[run] ${sourceNames[i]}: ${items.length} items`);
      allItems.push(...items);
    } else {
      console.warn(`[run] ${sourceNames[i]} failed: ${results[i].reason?.message}`);
    }
  }

  console.log(`[run] Total raw items: ${allItems.length}`);

  if (allItems.length === 0) {
    console.log('[run] No items collected, preserving existing feed');
    process.exit(0);
  }

  // Curate with Claude
  const curated = await curateItems(allItems);
  console.log(`[run] Curated items: ${curated.length}`);

  // Build HTML
  buildDashboard(curated);
  console.log('[run] Done!');
}

main().catch(err => {
  console.error('[run] Fatal error:', err);
  process.exit(1);
});
