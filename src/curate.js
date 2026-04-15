import Anthropic from '@anthropic-ai/sdk';
import { TOPICS, RELEVANCE_THRESHOLD, BATCH_SIZE, CLAUDE_MODEL } from './config.js';

const CURATION_PROMPT = `You are a news curator for a developer who works with Claude Code, AI web design, SEO/GEO, and application development.

Score each item for relevance (0-100) to these topics:
${Object.entries(TOPICS).map(([k, v]) => `- ${v.label}: ${k}`).join('\n')}

For each item, return JSON with:
- id (the index you received)
- relevance_score (0-100)
- topics (array of matching topic keys from the list above)
- summary (1-2 sentence summary explaining why this matters)
- is_top (boolean, true for the 3 most important items in this batch)

Be aggressive about filtering: general AI news that doesn't relate to web dev, SEO, Claude Code, or practical dev tools should score low.

Return ONLY a JSON array, no other text.`;

export async function curateItems(rawItems) {
  // Deduplicate by URL
  const seen = new Set();
  const unique = rawItems.filter(item => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });

  if (unique.length === 0) return [];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[curate] ANTHROPIC_API_KEY not set, returning raw items');
    return unique.map(item => ({ ...item, relevance_score: 50, topics: [], summary: item.description, is_top: false }));
  }

  const client = new Anthropic();
  const curated = [];

  // Process in batches
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);
    const batchInput = batch.map((item, idx) => ({
      id: idx,
      source: item.source,
      title: item.title,
      description: item.description?.slice(0, 200),
      url: item.url,
    }));

    try {
      const response = await client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: `${CURATION_PROMPT}\n\nItems to curate:\n${JSON.stringify(batchInput)}`,
        }],
      });

      const text = response.content[0]?.text || '[]';
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const scored = JSON.parse(jsonMatch ? jsonMatch[0] : '[]');

      for (const score of scored) {
        const original = batch[score.id];
        if (!original) continue;
        curated.push({
          ...original,
          relevance_score: score.relevance_score,
          topics: score.topics || [],
          summary: score.summary || original.description,
          is_top: score.is_top || false,
        });
      }
    } catch (err) {
      console.warn(`[curate] Claude API error for batch ${i}: ${err.message}`);
      // Fallback: include raw items from this batch
      for (const item of batch) {
        curated.push({ ...item, relevance_score: 50, topics: [], summary: item.description, is_top: false });
      }
    }
  }

  // Filter and sort
  return curated
    .filter(item => item.relevance_score >= RELEVANCE_THRESHOLD)
    .sort((a, b) => {
      if (a.is_top && !b.is_top) return -1;
      if (!a.is_top && b.is_top) return 1;
      return b.relevance_score - a.relevance_score;
    });
}
