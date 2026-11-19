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
      pad: s.padding,
      lh: s.lineHeight,
    };
  });
});
console.log(JSON.stringify(info));
await b.close();
