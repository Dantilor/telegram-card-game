import { chromium } from "playwright";
const b = await chromium.launch({ channel: "msedge", headless: true });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:4173/games", { waitUntil: "networkidle" });
await page.waitForSelector(".games-page__back");
const info = await page.evaluate(() => {
  const back = document.querySelector(".games-page__back");
  const tabs = document.querySelector(".catalog-tabs__group");
  const heroImg = document.querySelector(".hero-game-card .smart-image__img");
  const hero = document.querySelector(".hero-game-card");
  const media = document.querySelector(".hero-game-card__media");
  const s = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      w: Math.round(r.width), h: Math.round(r.height),
      radius: cs.borderRadius,
      bg: cs.backgroundColor || cs.backgroundImage.slice(0,100),
      shadow: cs.boxShadow,
      overflow: cs.overflow,
      filter: cs.backdropFilter || cs.webkitBackdropFilter,
      objectFit: cs.objectFit,
      objectPos: cs.objectPosition,
      transform: cs.transform,
    };
  };
  return { back: s(back), tabs: s(tabs), hero: s(hero), media: s(media), img: s(heroImg) };
});
console.log(JSON.stringify(info, null, 2));
await page.locator(".games-page__back").screenshot({ path: "artifacts/web-ui-pass/p5-back-sq.png" });
await page.locator(".catalog-tabs__group").screenshot({ path: "artifacts/web-ui-pass/p5-tabs-sq.png" });
await page.locator(".hero-game-card").first().screenshot({ path: "artifacts/web-ui-pass/p5-hero-zoom.png" });
await b.close();
