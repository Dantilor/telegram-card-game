import { chromium } from "playwright";
const b = await chromium.launch({ channel: "msedge", headless: true });
const phone = await b.newPage({ viewport: { width: 390, height: 844 } });
await phone.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
await phone.waitForSelector(".moods");
const info = await phone.evaluate(() => {
  const moods = [...document.querySelectorAll(".mood")];
  return moods.map((el) => {
    const r = el.getBoundingClientRect();
    const lock = el.querySelector(".mood-lock");
    const lr = lock ? lock.getBoundingClientRect() : null;
    return { w: Math.round(r.width), top: Math.round(r.top), lock: lock ? lock.textContent : "", clipped: lr ? lr.right > r.right + 1 : false };
  });
});
await phone.locator(".moods").screenshot({ path: "artifacts/web-ui-pass/p5-modes-390.png" });
console.log(JSON.stringify(info));
await b.close();
