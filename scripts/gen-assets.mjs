// Generate static brand assets with Playwright (real brand fonts, exact CSS):
//   public/og.png                 1200×630 social card (og:image / twitter:image)
//   public/icon-192.png/-512.png  PWA icons rendered from public/icon.svg
//   public/icon-maskable-*.png    same mark, extra safe-zone padding
// Run after changing the logo or brand copy:  node scripts/gen-assets.mjs
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const iconSvg = readFileSync(resolve(root, "public/icon.svg"), "utf8");

const OG_HTML = `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600&display=block" rel="stylesheet">
<style>
  *{margin:0; box-sizing:border-box}
  body{width:1200px; height:630px; background:#F4F0E6; font-family:"Hanken Grotesk",sans-serif; color:#211F18; overflow:hidden; position:relative}
  .card{padding:84px 96px; height:100%; display:flex; flex-direction:column; justify-content:space-between; position:relative; z-index:1}
  .brand{display:flex; align-items:center; gap:22px}
  .brand svg{width:84px; height:84px; border-radius:19px}
  .brand .name{font-family:Fraunces,serif; font-weight:600; font-size:46px; letter-spacing:-.01em}
  h1{font-family:Fraunces,serif; font-weight:600; font-size:84px; line-height:1.06; letter-spacing:-.015em; max-width:880px}
  h1 em{font-style:normal; color:#1E5B41}
  .sub{font-size:30px; color:#5C574B; font-weight:500}
  .sub b{color:#1E5B41; font-weight:600}
  .doc{position:absolute; right:-60px; top:110px; width:360px; height:470px; background:#FFFEFB; border-radius:18px;
    box-shadow:0 30px 80px rgba(33,31,24,.18); transform:rotate(6deg); padding:38px 34px; z-index:0}
  .doc .ln{height:13px; background:#E8E2D2; border-radius:7px; margin-bottom:20px}
  .doc .ttl{height:22px; width:55%; background:#1E5B41; border-radius:7px; margin-bottom:34px; opacity:.85}
  .doc .tot{height:26px; width:40%; background:#1E5B41; border-radius:7px; margin-top:46px; margin-left:auto}
</style></head><body>
  <div class="doc">
    <div class="ttl"></div>
    <div class="ln" style="width:85%"></div><div class="ln" style="width:70%"></div>
    <div class="ln" style="width:78%"></div><div class="ln" style="width:55%"></div>
    <div class="tot"></div>
  </div>
  <div class="card">
    <div class="brand">${iconSvg}<span class="name">Plainvoice</span></div>
    <h1>Invoicing that's <em>actually free.</em></h1>
    <div class="sub"><b>Unlimited invoices · no signup · no paywall.</b> Your data stays on your device.</div>
  </div>
</body></html>`;

const iconHtml = (size, pad) => `<!doctype html><html><head><style>
  *{margin:0} body{width:${size}px; height:${size}px; background:#1E5B41; display:grid; place-items:center}
  svg{width:${size - pad * 2}px; height:${size - pad * 2}px}
</style></head><body>${iconSvg}</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();

async function shoot(html, width, height, file) {
  await page.setViewportSize({ width, height });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: resolve(root, "public", file) });
  console.log("wrote public/" + file);
}

await shoot(OG_HTML, 1200, 630, "og.png");
// "any" icons: the SVG already carries its own rounded green tile
await shoot(iconHtml(192, 0), 192, 192, "icon-192.png");
await shoot(iconHtml(512, 0), 512, 512, "icon-512.png");
// maskable: pad to the ~80% safe zone so circular masks don't clip the doc
await shoot(iconHtml(192, 20), 192, 192, "icon-maskable-192.png");
await shoot(iconHtml(512, 52), 512, 512, "icon-maskable-512.png");

await browser.close();
