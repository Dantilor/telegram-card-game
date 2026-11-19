import { chromium } from "playwright";
const b = await chromium.launch({ channel: "msedge", headless: true });
const phone = await b.newPage({ viewport: { width: 390, height: 844 } });
await phone.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
await phone.waitForSelector(".mood");
const info = await phone.evaluate(() => {
  const moods = [...document.querySelectorAll(".mood")];
  const view = document.documentElement.clientWidth;
  return {
    view,
    cards: moods.map((el) => {
      const r = el.getBoundingClientRect();
      const lock = el.querySelector(".mood-lock");
      const lr = lock ? lock.getBoundingClientRect() : null;
      return {
        right: Math.round(r.right),
        w: Math.round(r.width),
        lock: lr ? lock.textContent : null,
        lockRight: lr ? Math.round(lr.right) : null,
        clipped: lr ? lr.right > r.right + 1 || lr.left < r.left - 1 : false,
      };
    }),
    overflow: document.documentElement.scrollWidth - view,
  };
});
await phone.screenshot({ path: "artifacts/web-ui-pass/p5-hero-modes-390.png", clip: { x: 0, y: 220, width: 390, height: 280 } });
await phone.close();
const desk = await b.newPage({ viewport: { width: 1440, height: 900 } });
await desk.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
await desk.locator("#gnh-why-title").scrollIntoViewIfNeeded();
await desk.waitForTimeout(200);
const why = await desk.evaluate(() => {
  const h = document.querySelector(".why-grid h3");
  return h ? getComputedStyle(h).color : null;
});
await desk.locator(".why-section").screenshot({ path: "artifacts/web-ui-pass/p5-why.png" });
await desk.close();
console.log(JSON.stringify({ info, why }, null, 2));
await b.close();
