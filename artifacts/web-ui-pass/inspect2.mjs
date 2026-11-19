import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const has = await page.evaluate(() => !!document.querySelector(".hero-play"));
console.log("has hero-play", has, "path", await page.evaluate(() => location.pathname));
const btn = page.locator(".hero-play").first();
if (await btn.count()) {
  const box = await btn.boundingBox();
  console.log("box", box);
  if (box) await page.screenshot({ path: "artifacts/web-ui-pass/start-btn-crop.png", clip: { x: Math.max(0, box.x - 10), y: Math.max(0, box.y - 10), width: box.width + 20, height: box.height + 20 } });
  const info = await page.evaluate(() => {
    const el = document.querySelector(".hero-play");
    const cs = getComputedStyle(el);
    const before = getComputedStyle(el, "::before");
    const after = getComputedStyle(el, "::after");
    return {
      html: el.innerHTML,
      display: cs.display,
      gap: cs.gap,
      padding: cs.padding,
      justify: cs.justifyContent,
      beforeContent: before.content,
      beforeDisplay: before.display,
      beforeW: before.width,
      beforeH: before.height,
      beforeBg: before.backgroundColor,
      beforeBorder: before.border,
      beforePos: before.position,
      afterContent: after.content,
      svg: el.querySelector("svg") && {
        fill: getComputedStyle(el.querySelector("svg")).fill,
        stroke: getComputedStyle(el.querySelector("svg")).stroke,
        strokeW: getComputedStyle(el.querySelector("svg")).strokeWidth,
        pathFill: getComputedStyle(el.querySelector("svg path")).fill,
        pathStroke: getComputedStyle(el.querySelector("svg path")).stroke,
      }
    };
  });
  console.log(JSON.stringify(info, null, 2));
}
await page.goto("http://127.0.0.1:4173/russia-travel", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
const rt = await page.evaluate(() => {
  document.documentElement.setAttribute("data-theme", "neon-dark");
  const deck = document.querySelector(".rt-page__deck");
  const title = deck?.querySelector(".rt-page__deck-title, h3");
  const desc = deck?.querySelector(".rt-page__deck-desc, p");
  const all = [...(deck?.querySelectorAll("*") || [])].map(el => {
    const cs = getComputedStyle(el);
    if (cs.backgroundColor === "rgba(0, 0, 0, 0)" && cs.backgroundImage === "none") return null;
    return { cls: el.className?.toString?.().slice(0,80), tag: el.tagName, bg: cs.backgroundColor, img: cs.backgroundImage.slice(0,80) };
  }).filter(Boolean);
  return {
    theme: document.documentElement.getAttribute("data-theme"),
    deckBg: deck && getComputedStyle(deck).backgroundImage.slice(0,100),
    titleBg: title && getComputedStyle(title).backgroundColor,
    descBg: desc && getComputedStyle(desc).backgroundColor,
    colored: all,
    heroAfter: (() => { const h = document.querySelector(".rt-travel-card"); const a = h && getComputedStyle(h, "::after"); return a && { c: a.content, bg: a.backgroundImage, w: a.width, h: a.height }; })(),
  };
});
console.log(JSON.stringify(rt, null, 2));
const deckBox = await page.locator(".rt-page__deck").first().boundingBox();
if (deckBox) await page.screenshot({ path: "artifacts/web-ui-pass/russia-deck-crop.png", clip: deckBox });
await browser.close();
