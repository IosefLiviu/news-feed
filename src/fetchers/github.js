import { GITHUB_KEYWORDS } from '../config.js';

export async function fetchGitHub() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const items = [];

  for (const keyword of GITHUB_KEYWORDS) {
    const query = encodeURIComponent(`${keyword} pushed:>${since}`);
    const url = `https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=10`;
    const headers = { 'Accept': 'application/vnd.github+json' };
    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) continue;
    const data = await res.json();

    for (const repo of (data.items || [])) {
      items.push({
        source: 'github',
        title: repo.full_name,
        url: repo.html_url,
        description: repo.description || '',
        metadata: { stars: repo.stargazers_count, language: repo.language },
        timestamp: repo.pushed_at,
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
