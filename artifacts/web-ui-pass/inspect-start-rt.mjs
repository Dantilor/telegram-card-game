import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
const info = await page.evaluate(() => {
  const btn = document.querySelector(".hero-play");
  if (!btn) return { missing: true };
  const r = btn.getBoundingClientRect();
  const cs = getComputedStyle(btn);
  const kids = [...btn.children].map((c) => {
    const k = getComputedStyle(c);
    const kr = c.getBoundingClientRect();
    return { tag: c.tagName, cls: c.className?.toString?.(), w: Math.round(kr.width), h: Math.round(kr.height), x: Math.round(kr.x - r.x), bg: k.backgroundColor, border: k.border, before: getComputedStyle(c, "::before").content, after: getComputedStyle(c, "::after").content };
  });
  return {
    text: btn.textContent,
    html: btn.innerHTML,
    w: Math.round(r.width), h: Math.round(r.height),
    gap: cs.gap, padding: cs.padding, justify: cs.justifyContent, align: cs.alignItems,
    before: { content: getComputedStyle(btn, "::before").content, w: getComputedStyle(btn, "::before").width, bg: getComputedStyle(btn, "::before").backgroundColor, border: getComputedStyle(btn, "::before").borderLeft },
    after: { content: getComputedStyle(btn, "::after").content },
    kids,
    borderLeft: cs.borderLeft,
    boxShadow: cs.boxShadow,
  };
});
const box = await page.evaluate(() => {
  const btn = document.querySelector(".hero-play");
  const r = btn.getBoundingClientRect();
  return { x: Math.floor(r.x - 8), y: Math.floor(r.y - 8), w: Math.ceil(r.width + 16), h: Math.ceil(r.height + 16) };
});
await page.screenshot({ path: "artifacts/web-ui-pass/start-btn-crop.png", clip: box });
console.log(JSON.stringify(info, null, 2));

// russia dark text plates
await page.goto("http://127.0.0.1:4173/russia-travel", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
const rt = await page.evaluate(() => {
  const deck = document.querySelector(".rt-page__deck");
  const title = deck?.querySelector(".rt-page__deck-title");
  const desc = deck?.querySelector(".rt-page__deck-desc");
  const hero = document.querySelector(".rt-page__hero");
  const dump = (el) => el && ({
    cls: el.className,
    bg: getComputedStyle(el).backgroundColor,
    img: getComputedStyle(el).backgroundImage.slice(0,120),
    color: getComputedStyle(el).color,
    shadow: getComputedStyle(el).textShadow,
    filter: getComputedStyle(el).filter,
  });
  const after = hero && getComputedStyle(hero, "::after");
  return {
    theme: document.documentElement.getAttribute("data-theme"),
    deck: dump(deck),
    title: dump(title),
    desc: dump(desc),
    heroAfter: after && { content: after.content, bg: after.backgroundImage || after.backgroundColor, w: after.width, h: after.height },
    paper: deck && getComputedStyle(deck).getPropertyValue("--rt-paper"),
  };
});
console.log("rt", JSON.stringify(rt, null, 2));
await page.screenshot({ path: "artifacts/web-ui-pass/russia-deck-crop.png", clip: { x: 80, y: 280, width: 700, height: 280 } });
await browser.close();
