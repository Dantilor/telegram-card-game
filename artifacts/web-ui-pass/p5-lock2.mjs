import { chromium } from "playwright";
const b = await chromium.launch({ channel: "msedge", headless: true });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
await page.waitForSelector(".mood-lock");
const info = await page.evaluate(() => {
  return [...document.querySelectorAll(".mood-lock")].map((el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return {
      w: Math.round(r.width),
      h: Math.round(r.height),
      font: s.fontSize,
      radius: s.borderRadius,
      bg: s.backgroundImage.slice(0, 80),
    };
  });
});
console.log(JSON.stringify(info));
await page.locator(".moods").screenshot({ path: "artifacts/web-ui-pass/p5-mood-lock.png" });
await b.close();
