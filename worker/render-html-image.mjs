// Generic HTML → PNG renderer for the Albunyaan content machines (gebeds posts,
// 2-paths overlays, future carousels). Uses Playwright's OWN headless chromium —
// never the shared twin browser — so it runs safely at any time, including while
// the migration harvest is active.
// Usage: node_modules/.bin/tsx render-html-image.mjs <input.html> <output.png> <width> <height>
import { chromium } from 'playwright';
const [, , input, output, w = '1080', h = '1080'] = process.argv;
if (!input || !output) {
  console.error('usage: render-html-image.mjs <input.html> <output.png> [width] [height]');
  process.exit(1);
}
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: parseInt(w), height: parseInt(h) }, deviceScaleFactor: 1 });
await page.goto(`file://${input.startsWith('/') ? input : process.cwd() + '/' + input}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400); // font settle
await page.screenshot({ path: output, clip: { x: 0, y: 0, width: parseInt(w), height: parseInt(h) } });
await browser.close();
console.log(`rendered ${output} (${w}x${h})`);
process.exit(0);
