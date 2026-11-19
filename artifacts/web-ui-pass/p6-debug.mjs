import { chromium } from "playwright";
const b = await chromium.launch({ channel: "msedge", headless: true });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:4173/games", { waitUntil: "networkidle" });
const info = await page.evaluate(() => {
  const html = document.documentElement.getAttribute("data-gnh-shell");
  const app = document.querySelector(".app");
  const inside = document.querySelector(".gnh-inside");
  const back = document.querySelector(".games-page__back");
  const hero = document.querySelector(".hero-game-card--top") || document.querySelector(".hero-game-card");
  const css = [...document.styleSheets].map(s => s.href).filter(Boolean);
  return {
    shell: html,
    appClass: app?.className,
    hasInside: !!inside,
    backClass: back?.className,
    heroClass: hero?.className,
    heroRect: hero ? (() => { const r = hero.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; })() : null,
    cssFiles: css.slice(-5),
    matched: back ? [...back.ownerDocument.styleSheets].length : 0,
  };
});
console.log(JSON.stringify(info, null, 2));
// force compute which rule sets back background
const detail = await page.evaluate(() => {
  const back = document.querySelector(".games-page__back");
  const hero = document.querySelector(".hero-game-card");
  const actionsProbe = getComputedStyle(document.body);
  return {
    backBg: getComputedStyle(back).background,
    backBgImg: getComputedStyle(back).backgroundImage,
    heroH: getComputedStyle(hero).height,
    heroMinH: getComputedStyle(hero).minHeight,
  };
});
console.log(JSON.stringify(detail, null, 2));
await b.close();
