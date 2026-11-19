import { chromium } from "playwright";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const themes = ["neon-dark", "neon-light", "sunset", "minimal-calm"];

async function measure(width) {
  const box = (el) => {
    if (!el) return null;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      w: Math.round(r.width),
      h: Math.round(r.height),
      x: Math.round(r.x),
      font: s.fontSize,
      pad: s.paddingLeft,
      color: s.color,
      bg: s.backgroundColor,
    };
  };
  const scroller = document.querySelector(".gnh-home-scroll") || document.querySelector(".gnh-inside") || document.scrollingElement;
  const header = document.querySelector(".site-header") || document.querySelector(".app-header");
  const inner = document.querySelector(".header-inner");
  const wrap = document.querySelector(".catalog-section.wrap") || document.querySelector(".content");
  const h1 = document.querySelector(".hero h1") || document.querySelector(".games-page-header__title") || document.querySelector("h1");
  const h2 = document.querySelector(".section-heading h2") || document.querySelector(".games-page-header__title");
  const title = document.querySelector(".game-title") || document.querySelector(".games-grid__title");
  const meta = document.querySelector(".game-metadata") || document.querySelector(".games-grid__desc");
  const brand = document.querySelector(".brand");
  const nav = document.querySelector(".desktop-nav") || document.querySelector(".header-nav");
  const premium = document.querySelector(".premium-button") || document.querySelector(".premium-nav");
  const art = document.querySelector(".hero-art");
  const overlaps = [];
  const nodes = [...document.querySelectorAll(".site-header .brand, .site-header .desktop-nav, .site-header .premium-button, .site-header .menu-button, .site-header .gnh-player-count, .app-header .brand, .app-header .header-nav, .app-header .premium-nav")].filter((n) => getComputedStyle(n).display !== "none");
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i].getBoundingClientRect();
    if (a.width < 2 || a.height < 2) continue;
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j].getBoundingClientRect();
      if (b.width < 2 || b.height < 2) continue;
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 2 && oy > 2) overlaps.push(nodes[i].className + " | " + nodes[j].className + " " + Math.round(ox));
    }
  }
  return {
    width,
    scrollW: scroller.scrollWidth,
    clientW: scroller.clientWidth,
    overflow: scroller.scrollWidth - scroller.clientWidth,
    header: box(header),
    inner: box(inner),
    wrap: box(wrap),
    h1: box(h1),
    h2: box(h2),
    title: box(title),
    meta: box(meta),
    brand: box(brand),
    navDisplay: nav ? getComputedStyle(nav).display : null,
    premium: box(premium),
    art: art ? { w: Math.round(art.getBoundingClientRect().width), x: Math.round(art.getBoundingClientRect().x) } : null,
    overlaps,
  };
}

const out = {};
for (const width of [1920, 1440, 768, 390]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
  out["home-" + width] = await page.evaluate(measure, width);
  await page.screenshot({ path: `artifacts/web-ui-pass/layout-home-${width}.png` });
  await page.goto("http://127.0.0.1:4173/games", { waitUntil: "networkidle" });
  out["games-" + width] = await page.evaluate(measure, width);
  if (width === 1440 || width === 390) {
    await page.screenshot({ path: `artifacts/web-ui-pass/layout-games-${width}.png` });
  }
  await page.close();
}

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:4173/games", { waitUntil: "networkidle" });
for (const theme of themes) {
  await page.evaluate((theme) => { document.documentElement.dataset.theme = theme; }, theme);
  await page.waitForTimeout(150);
  const sample = await page.evaluate(() => {
    const title = document.querySelector(".games-page-header__title");
    const card = document.querySelector(".games-grid__title");
    const header = document.querySelector(".app-header");
    const cs = (el) => el ? getComputedStyle(el).color : null;
    return { title: cs(title), card: cs(card), header: cs(header), headerBg: header ? getComputedStyle(header).backgroundColor : null };
  });
  out["theme-" + theme] = sample;
  await page.screenshot({ path: `artifacts/web-ui-pass/layout-theme-${theme}.png` });
}
await browser.close();
console.log(JSON.stringify(out, null, 2));
