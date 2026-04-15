import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

export function buildDashboard(curatedItems) {
  const template = readFileSync(join(ROOT, 'template', 'dashboard.html'), 'utf-8');

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const html = template
    .replace('{{DATA}}', JSON.stringify(curatedItems))
    .replace('{{DATE}}', dateStr)
    .replace('{{COUNT}}', String(curatedItems.length));

  mkdirSync(join(ROOT, 'docs'), { recursive: true });
  writeFileSync(join(ROOT, 'docs', 'index.html'), html, 'utf-8');

  console.log(`[build] Generated docs/index.html with ${curatedItems.length} items`);
}
