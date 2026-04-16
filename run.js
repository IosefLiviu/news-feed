import { fetchGitHub } from './src/fetchers/github.js';
import { fetchYouTube } from './src/fetchers/youtube.js';
import { fetchTwitter } from './src/fetchers/twitter.js';
import { fetchReddit } from './src/fetchers/reddit.js';
import { fetchBlogs } from './src/fetchers/blogs.js';
import { fetchProductHunt } from './src/fetchers/producthunt.js';
import { fetchOnePiece } from './src/fetchers/onepiece.js';
import { curateItems } from './src/curate.js';
import { buildDashboard } from './src/build.js';

async function main() {
  console.log('[run] Starting daily feed pipeline...');

  // News sources (fed through Claude curation)
  const newsResults = await Promise.allSettled([
    fetchGitHub(),
    fetchYouTube(),
    fetchTwitter(),
    fetchReddit(),
    fetchBlogs(),
    fetchProductHunt(),
  ]);

  const sourceNames = ['GitHub', 'YouTube', 'Twitter', 'Reddit', 'Blogs', 'ProductHunt'];
  const allNewsItems = [];

  for (let i = 0; i < newsResults.length; i++) {
    if (newsResults[i].status === 'fulfilled') {
      const items = newsResults[i].value;
      console.log(`[run] ${sourceNames[i]}: ${items.length} items`);
      allNewsItems.push(...items);
    } else {
      console.warn(`[run] ${sourceNames[i]} failed: ${newsResults[i].reason?.message}`);
    }
  }

  console.log(`[run] Total raw news items: ${allNewsItems.length}`);

  // TCG section (One Piece booster boxes — no Claude curation, price/stock are facts)
  let tcgItems = [];
  try {
    tcgItems = await fetchOnePiece();
  } catch (err) {
    console.warn(`[run] OnePiece TCG fetch failed: ${err.message}`);
  }

  if (allNewsItems.length === 0 && tcgItems.length === 0) {
    console.log('[run] No items collected, preserving existing feed');
    process.exit(0);
  }

  // Curate news with Claude
  const curated = allNewsItems.length
    ? await curateItems(allNewsItems)
    : [];
  console.log(`[run] Curated news items: ${curated.length}`);

  // Build HTML (news + TCG)
  buildDashboard(curated, tcgItems);
  console.log('[run] Done!');
}

main().catch(err => {
  console.error('[run] Fatal error:', err);
  process.exit(1);
});
