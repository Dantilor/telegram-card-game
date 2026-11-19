import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:4173/games", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const info = await page.evaluate(() => {
  const img = document.querySelector('a.hero-game-card--bottom[href="/russia-travel"] img');
  return {
    natW: img?.naturalWidth,
    natH: img?.naturalHeight,
    ratio: img ? (img.naturalWidth / img.naturalHeight).toFixed(3) : null,
    dispW: img?.clientWidth,
    dispH: img?.clientHeight,
    src: img?.currentSrc || img?.src,
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
