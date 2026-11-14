/**
 * Makes the link-preview pictures (static/og/<paper>.png, 1200×630) shown when a share link is
 * sent in Messages, WhatsApp and the like: a present in that list's wrapping paper on the app's
 * cocoa, with the stripes. One per paper, made ahead of time, so nothing is drawn per request.
 *
 *   npx tsx scripts/og-images.ts      (needs Playwright's Chromium)
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { PAPERS } from '../src/lib/papers.ts';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const font = (path: string) => `data:font/woff2;base64,${readFileSync(new URL(`../node_modules/${path}`, import.meta.url)).toString('base64')}`;
const shrikhand = font('@fontsource/shrikhand/files/shrikhand-latin-400-normal.woff2');
const dmSans = font('@fontsource-variable/dm-sans/files/dm-sans-latin-opsz-normal.woff2');

function page(p: (typeof PAPERS)[number]) {
	return `<!doctype html><html><head><style>
@font-face { font-family: Shrikhand; src: url(${shrikhand}); }
@font-face { font-family: DM; src: url(${dmSans}); font-weight: 100 1000; }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; background: #2b1d14; font-family: DM; color: #f3e7cf; position: relative; overflow: hidden; }
.stripes { position: absolute; left: 0; right: 0; top: 0; height: 30px; background: linear-gradient(#e8a83a 0 33.4%, #d2602d 33.4% 66.7%, #3e8e87 66.7%); }
.shelf { position: absolute; left: 70px; top: 470px; width: 520px; height: 26px; border-radius: 6px;
  background: linear-gradient(#9a7550 0 6px, #6e4f35 6px 16px, #5a3f2a 16px); box-shadow: 0 6px 0 #1a110b, 0 26px 30px -14px #000; }
.present { position: absolute; left: 110px; top: 150px; width: 440px; height: 322px; border-radius: 24px; overflow: hidden;
  background: ${p.background}; box-shadow: inset 0 -14px 0 rgb(0 0 0 / .14); }
.rv { position: absolute; top: 0; bottom: 0; left: calc(50% - 18px); width: 36px; background: ${p.ribbon}; }
.rh { position: absolute; left: 0; right: 0; top: calc(42% - 18px); height: 36px; background: ${p.ribbon}; }
.bow { position: absolute; left: calc(50% - 102px); top: calc(42% - 92px); }
.tag { position: absolute; left: 140px; top: 400px; transform: rotate(-7deg); background: #f3e7cf; color: #2b1d14; font-weight: 800; font-size: 30px;
  padding: 10px 26px 10px 46px; clip-path: polygon(24px 0, 100% 0, 100% 100%, 24px 100%, 0 50%); border-radius: 0 14px 14px 0; }
.tag::before { content: ''; position: absolute; left: 20px; top: 50%; width: 14px; height: 14px; margin-top: -7px; border-radius: 50%; background: #2b1d14; }
.text { position: absolute; left: 640px; right: 60px; top: 0; bottom: 30px; display: flex; flex-direction: column; justify-content: center; }
h1 { font-family: Shrikhand; font-weight: 400; font-size: 66px; line-height: 1.04; }
.bar { width: 90px; height: 12px; border-radius: 99px; background: #e8a83a; margin-top: 22px; }
p { margin-top: 22px; font-size: 30px; color: #c9b79a; line-height: 1.3; }
.brand { margin-top: 36px; display: flex; align-items: center; gap: 14px; font-family: Shrikhand; font-size: 36px; }
</style></head><body>
<div class="stripes"></div>
<div class="present"><div class="rv"></div><div class="rh"></div>
<svg class="bow" width="204" height="156" viewBox="0 0 68 52"><g stroke="#2B1D14" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">
<path d="M31 31l-11 18 7-1 3 5 6-18z" fill="${p.ribbon}"/><path d="M37 31l11 18-7-1-3 5-6-18z" fill="${p.ribbon}"/>
<path d="M34 30C26 12 6 5 5 18c-1 12 17 14 29 12z" fill="${p.ribbon}"/><path d="M34 30C42 12 62 5 63 18c1 12-17 14-29 12z" fill="${p.ribbon}"/>
<path d="M34 30C28 20 15 16 14 20.5S26 29 34 30zM34 30c6-10 19-14 20-9.5S42 29 34 30z" fill="${p.bow}" stroke="none" opacity="0.7"/>
<rect x="27" y="23" width="14" height="14" rx="5" fill="${p.ribbon}"/></g></svg></div>
<div class="shelf"></div>
<div class="tag">For you</div>
<div class="text"><h1>A wish list, just for you</h1><div class="bar"></div><p>Pick something, tap “I’ll get this”, and it stays a surprise.</p>
<div class="brand"><svg width="48" height="48" viewBox="0 0 32 32"><rect x="5" y="13" width="22" height="15" rx="3" fill="#e8a83a"/><rect x="3" y="9" width="26" height="6" rx="2" fill="#d2602d"/><rect x="14" y="9" width="4" height="19" fill="#3e8e87"/></svg>The Giver</div></div>
</body></html>`;
}

const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const p of PAPERS) {
	await tab.setContent(page(p), { waitUntil: 'load' });
	await tab.evaluate(() => document.fonts.ready);
	writeFileSync(new URL(`../static/og/${p.id}.png`, import.meta.url), await tab.screenshot({ type: 'png' }));
	console.log('made', p.id);
}
await browser.close();
