import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
await page.goto("http://127.0.0.1:4173/games", { waitUntil: "networkidle" });
const offenders = await page.evaluate(() => {
  const root = document.querySelector(".gnh-inside");
  const limit = root.clientWidth + 1;
  const out = [];
  for (const el of root.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (r.right > limit + 1 || r.left < -1) {
      out.push({
        tag: el.tagName,
        cls: String(el.className).slice(0, 80),
        left: Math.round(r.left),
        right: Math.round(r.right),
        w: Math.round(r.width),
      });
    }
  }
  return { limit, count: out.length, out: out.slice(0, 20) };
});
console.log(JSON.stringify(offenders, null, 2));
await browser.close();
