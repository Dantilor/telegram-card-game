import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
await page.goto("http://127.0.0.1:4173/games", { waitUntil: "domcontentloaded" });
await page.waitForSelector(".bottom-nav");
const info = await page.evaluate(() => {
  const nav = document.querySelector(".bottom-nav");
  const s = getComputedStyle(nav);
  const r = nav.getBoundingClientRect();
  return { left: s.left, right: s.right, width: s.width, max: s.maxWidth, display: s.display, box: [Math.round(r.left), Math.round(r.right), Math.round(r.width)] };
});
const overflow = await page.evaluate(() => {
  const scroller = document.querySelector(".gnh-inside");
  return scroller.scrollWidth - scroller.clientWidth;
});
console.log(JSON.stringify({ info, overflow }));
await browser.close();
