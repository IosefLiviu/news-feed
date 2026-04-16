import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

export function buildDashboard(curatedItems, tcgItems = []) {
  const template = readFileSync(join(ROOT, 'template', 'dashboard.html'), 'utf-8');

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const html = template
    .replaceAll('{{DATA}}', JSON.stringify(curatedItems))
    .replaceAll('{{TCG_DATA}}', JSON.stringify(tcgItems))
    .replaceAll('{{DATE}}', dateStr)
    .replaceAll('{{COUNT}}', String(curatedItems.length))
    .replaceAll('{{TCG_COUNT}}', String(tcgItems.filter(i => i.inStock).length));

  mkdirSync(join(ROOT, 'docs'), { recursive: true });
  writeFileSync(join(ROOT, 'docs', 'index.html'), html, 'utf-8');

  console.log(`[build] Generated docs/index.html with ${curatedItems.length} news items + ${tcgItems.length} TCG items`);
}
