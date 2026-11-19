import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:4173/games", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.evaluate(() => {
  const el = document.querySelector('a.hero-game-card--bottom[href="/russia-travel"]');
  const scroller = document.querySelector(".gnh-inside") || document.scrollingElement;
  if (el && scroller) scroller.scrollTo({ top: el.getBoundingClientRect().top + scroller.scrollTop - 80 });
});
await page.waitForTimeout(300);
const info = await page.evaluate(() => {
  const card = document.querySelector('a.hero-game-card--bottom[href="/russia-travel"]');
  const img = card?.querySelector("img");
  const cs = img && getComputedStyle(img);
  const box = card?.getBoundingClientRect();
  return {
    fit: cs?.objectFit,
    pos: cs?.objectPosition,
    cls: card?.className,
    h: box && Math.round(box.height),
    w: box && Math.round(box.width),
    inline: img?.getAttribute("style"),
  };
});
console.log(JSON.stringify(info, null, 2));
const box = await page.locator('a.hero-game-card--bottom[href="/russia-travel"]').boundingBox();
if (box) await page.screenshot({ path: "artifacts/web-ui-pass/russia-hero-zoomout.png", clip: box });
await browser.close();
