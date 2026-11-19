import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:4173/comics", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const info = await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button, a")].find((el) => /Назад/.test(el.textContent || ""));
  if (!btn) return { missing: true };
  const r = btn.getBoundingClientRect();
  const cs = getComputedStyle(btn);
  const parents = [];
  let n = btn.parentElement;
  for (let i = 0; i < 6 && n; i++) {
    const p = getComputedStyle(n);
    const pr = n.getBoundingClientRect();
    parents.push({
      cls: n.className?.toString?.().slice(0, 100),
      bg: p.backgroundColor,
      img: p.backgroundImage.slice(0, 100),
      radius: p.borderRadius,
      filter: p.backdropFilter || p.webkitBackdropFilter,
      w: Math.round(pr.width),
      h: Math.round(pr.height),
      overflow: p.overflow,
    });
    n = n.parentElement;
  }
  return {
    cls: btn.className,
    bg: cs.backgroundColor,
    img: cs.backgroundImage,
    radius: cs.borderRadius,
    filter: cs.backdropFilter || cs.webkitBackdropFilter,
    shadow: cs.boxShadow,
    outline: cs.outline,
    overflow: cs.overflow,
    w: Math.round(r.width),
    h: Math.round(r.height),
    x: Math.round(r.x),
    y: Math.round(r.y),
    parents,
  };
});
console.log(JSON.stringify(info, null, 2));
// crop screenshot of back button area
await page.screenshot({ path: "artifacts/web-ui-pass/back-crop.png", clip: { x: 0, y: 70, width: 280, height: 100 } });
await page.goto("http://127.0.0.1:4173/play/aboutUs", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.evaluate(() => document.querySelector(".play-page__actions")?.scrollIntoView({ block: "end" }));
await page.waitForTimeout(200);
const fav = await page.evaluate(() => {
  const el = document.querySelector(".play-page__fav-btn");
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
await page.screenshot({ path: "artifacts/web-ui-pass/fav-crop.png", clip: { x: Math.max(0, fav.x - 20), y: Math.max(0, fav.y - 20), width: Math.min(900, fav.w + 40), height: 160 } });
await browser.close();
