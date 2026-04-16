/**
 * Scrapes Romanian TCG stores for One Piece Card Game 24-pack booster displays.
 * Returns items sorted cheapest-first, in-stock only.
 *
 * Sources:
 *   - tcgarena.ro (Shopify /products.json — JSON, clean)
 *   - tcgmania.ro (/booster-display-2 + /premium-booster-display HTML scrape)
 *
 * krit.ro blocks scrapers (403 / Cloudflare); included as a manual link in
 * the dashboard instead.
 */

// Matches titles like:
//   "... Booster Display ... (24 pachete)"
//   "... Booster Display OP12 (24 Packs) ..."
//   "... Booster Box ..."   (some stores label their 24-pack display as a "box")
// Excludes starter decks, blisters, singles, tins.
const TITLE_INCLUDE = /\b(booster\s*display|booster\s*box|display\s*box|24\s*(pachete|pack))/i;
const TITLE_EXCLUDE = /\b(starter\s*deck|premium\s*card\s*collection|blister|single|tin\s*set|playmat|illustration\s*box|devil\s*fruit|double\s*pack|gift\s*box|learn\s*to\s*play|card\s*collection|acrylic|sleeved)/i;

// 6-pack starter displays (not what we want) — explicit block.
const TITLE_EXCLUDE_STRICT = /\b(6\s*(pachete|pack)|starter\s*deck\s*display)/i;

// Matches the set code we want to surface (OP-01 through OP-20, EB-01 through EB-10, PRB-xx, ST-xx).
const SET_CODE_RE = /\b(OP[- ]?(\d{1,2})|EB[- ]?(\d{1,2})|PRB[- ]?(\d{1,2})|ST[- ]?(\d{1,2}))\b/i;

/**
 * Normalise Romanian price string "1.099,90" → 1099.9
 * Also handles "1099.90" / "1,099.90" / "490.00"
 */
function parsePrice(str) {
  if (!str) return null;
  const s = String(str).trim().replace(/\s+/g, '').replace(/RON/gi, '');
  // Romanian format: thousands sep "." and decimal ","
  //   "1.099,90" → "1099.90"
  // English:      thousands "," and decimal "."
  //   "1,099.90" → "1099.90"
  // Simple (no sep): "490.00" or "490,00"
  let normalised;
  if (s.includes('.') && s.includes(',')) {
    // Both present — last one is the decimal
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    if (lastComma > lastDot) {
      // Romanian: "." = thousands, "," = decimal
      normalised = s.replace(/\./g, '').replace(',', '.');
    } else {
      // English: "," = thousands, "." = decimal
      normalised = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    // Only comma: likely Romanian decimal ("490,00")
    normalised = s.replace(',', '.');
  } else {
    normalised = s;
  }
  const n = parseFloat(normalised);
  return Number.isFinite(n) ? n : null;
}

/** Extract set code from title, normalising to canonical form (e.g. "OP-12", "EB-03"). */
function extractSetCode(title) {
  const m = title.match(SET_CODE_RE);
  if (!m) return null;
  // Normalise prefix+number regardless of original separator (OP12, OP-12, OP 12 → OP-12)
  const parsed = m[0].toUpperCase().match(/([A-Z]+)[- ]?(\d{1,2})/);
  if (!parsed) return m[0].toUpperCase();
  return `${parsed[1]}-${parsed[2].padStart(2, '0')}`;
}

/** Filter: is this title a One Piece 24-pack booster display? */
function isTargetProduct(title) {
  if (!title) return false;
  const t = title.toLowerCase();
  if (!t.includes('one piece') && !t.includes('opcg')) return false;
  if (TITLE_EXCLUDE.test(t)) return false;
  if (TITLE_EXCLUDE_STRICT.test(t)) return false;
  return TITLE_INCLUDE.test(t);
}

// ─── tcgarena.ro (Shopify) ─────────────────────────────────────────
async function fetchTcgarena() {
  const items = [];
  const base = 'https://tcgarena.ro';

  for (let page = 1; page <= 5; page++) {
    try {
      const res = await fetch(`${base}/products.json?limit=250&page=${page}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OnePieceBot/1.0)' },
      });
      if (!res.ok) break;
      const data = await res.json();
      const products = data.products || [];
      if (products.length === 0) break;

      for (const p of products) {
        if (!isTargetProduct(p.title)) continue;
        const v = p.variants?.[0];
        if (!v) continue;
        const price = parsePrice(v.price);
        if (price == null) continue;

        items.push({
          source: 'tcg-onepiece',
          store: 'tcgarena.ro',
          title: p.title.trim(),
          url: `${base}/products/${p.handle}`,
          imageUrl: p.images?.[0]?.src || null,
          price,
          currency: 'RON',
          inStock: Boolean(v.available),
          setCode: extractSetCode(p.title),
          lastSeen: new Date().toISOString(),
        });
      }

      if (products.length < 250) break;
    } catch (err) {
      console.warn(`[onepiece] tcgarena.ro page ${page} failed: ${err.message}`);
      break;
    }
  }

  return items;
}

// ─── tcgmania.ro (HTML scrape) ─────────────────────────────────────
async function fetchTcgmaniaCategory(path) {
  const url = `https://tcgmania.ro${path}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'ro-RO,ro;q=0.9,en;q=0.8',
    },
  });
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
  const html = await res.text();

  const items = [];
  // Split HTML by product card boundary
  const blocks = html.split(/<div class="product product--grid"/).slice(1);

  for (const blk of blocks) {
    // Truncate each block to end-of-card (next "<div class=\"product product--grid\"" or section end)
    const bounded = blk.split(/<div class="product product--grid"|<section/)[0];

    // Extract title + URL
    const nameMatch = bounded.match(/class="product__name"\s+href="([^"]+)"[^>]*>\s*([^<]+)/);
    if (!nameMatch) continue;
    const productUrl = nameMatch[1];
    // Decode HTML entities in title (&amp; &quot; &#039; etc.)
    const title = nameMatch[2]
      .trim()
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&#x2F;/g, '/');

    if (!isTargetProduct(title)) continue;

    // Extract current price — first <span>NUM<span>RON</span></span> in block
    const priceMatch = bounded.match(/<span>\s*([\d.,]+)\s*<span>\s*RON/);
    const price = priceMatch ? parsePrice(priceMatch[1]) : null;
    if (price == null) continue;

    // Stock: presence of .product__add-to-cart means in-stock on tcgmania
    const inStock = /product__add-to-cart/.test(bounded);

    // Extract lead image (lazy-loaded via data-src)
    const imgMatch = bounded.match(/<img[^>]*\sdata-src="([^"]+)"/) ||
                     bounded.match(/<img[^>]*\ssrc="(https:[^"]+\.(?:jpg|jpeg|png|webp))/i);

    items.push({
      source: 'tcg-onepiece',
      store: 'tcgmania.ro',
      title,
      url: productUrl.startsWith('http') ? productUrl : `https://tcgmania.ro${productUrl}`,
      imageUrl: imgMatch ? imgMatch[1] : null,
      price,
      currency: 'RON',
      inStock,
      setCode: extractSetCode(title),
      lastSeen: new Date().toISOString(),
    });
  }

  return items;
}

async function fetchTcgmania() {
  const items = [];
  // Dedicated One Piece booster-display subcategories
  const paths = ['/booster-display-2', '/premium-booster-display'];
  for (const path of paths) {
    try {
      const catItems = await fetchTcgmaniaCategory(path);
      items.push(...catItems);
    } catch (err) {
      console.warn(`[onepiece] tcgmania.ro ${path} failed: ${err.message}`);
    }
  }
  return items;
}

// ─── Main ──────────────────────────────────────────────────────────
export async function fetchOnePiece() {
  const [a, b] = await Promise.allSettled([fetchTcgarena(), fetchTcgmania()]);
  const raw = [];
  if (a.status === 'fulfilled') raw.push(...a.value);
  else console.warn(`[onepiece] tcgarena failed: ${a.reason?.message}`);
  if (b.status === 'fulfilled') raw.push(...b.value);
  else console.warn(`[onepiece] tcgmania failed: ${b.reason?.message}`);

  // Deduplicate by URL
  const seen = new Set();
  const unique = raw.filter(it => {
    if (seen.has(it.url)) return false;
    seen.add(it.url);
    return true;
  });

  // Sort: in-stock first, then by price ascending
  unique.sort((a, b) => {
    if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
    return a.price - b.price;
  });

  console.log(
    `[onepiece] ${unique.length} total (${unique.filter(i => i.inStock).length} in stock) ` +
    `across ${new Set(unique.map(i => i.store)).size} stores`,
  );

  return unique;
}
