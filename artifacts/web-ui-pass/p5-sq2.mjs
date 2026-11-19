import { chromium } from "playwright";
const b = await chromium.launch({ channel: "msedge", headless: true });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:4173/games", { waitUntil: "networkidle" });
await page.waitForSelector(".games-page__back");
const info = await page.evaluate(() => {
  const back = document.querySelector(".games-page__back");
  const kids = [...back.querySelectorAll("*")].map((el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName,
      cls: el.className?.toString?.().slice(0,80),
      w: Math.round(r.width), h: Math.round(r.height),
      border: s.border,
      outline: s.outline,
      bg: s.backgroundColor,
      radius: s.borderRadius,
      shadow: s.boxShadow,
    };
  });
  return { html: back.outerHTML.slice(0, 500), kids };
});
console.log(JSON.stringify(info, null, 2));

await page.goto("http://127.0.0.1:4173/truth-dare", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const actions = await page.evaluate(() => {
  const el = document.querySelector(".game-page__actions");
  if (!el) return null;
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    w: Math.round(r.width), h: Math.round(r.height),
    bg: s.backgroundImage.slice(0,140) || s.backgroundColor,
    radius: s.borderRadius,
    pad: s.padding,
    html: el.outerHTML.slice(0, 300),
  };
});
console.log("ACTIONS", JSON.stringify(actions, null, 2));
if (actions) {
  await page.locator(".game-page__actions").screenshot({ path: "artifacts/web-ui-pass/p5-actions-sq.png" });
}
await b.close();
