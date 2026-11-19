import { chromium } from "playwright";
const b = await chromium.launch({ channel: "msedge", headless: true });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
await page.waitForSelector(".game-card");
const info = await page.evaluate(() => {
  const badgeWrap = document.querySelector(".gnh-existing-badges");
  const badge = document.querySelector(".gnh-card-badge");
  const link = document.querySelector(".all-games-link");
  const hero = document.querySelector(".hero");
  const cats = document.querySelector(".categories-section");
  const shade = document.querySelector(".hero-shade");
  const br = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { t: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width) };
  };
  const bs = badge ? getComputedStyle(badge) : null;
  const ls = link ? getComputedStyle(link) : null;
  const ss = shade ? getComputedStyle(shade) : null;
  return {
    badgeTop: badgeWrap ? getComputedStyle(badgeWrap).top : null,
    badgeSize: badge ? { w: Math.round(badge.getBoundingClientRect().width), h: Math.round(badge.getBoundingClientRect().height), font: bs.fontSize } : null,
    link: link ? { h: Math.round(link.getBoundingClientRect().height), radius: ls.borderRadius, border: ls.border, pad: ls.padding } : null,
    heroBottom: hero ? Math.round(hero.getBoundingClientRect().bottom) : null,
    catsTop: cats ? Math.round(cats.getBoundingClientRect().top) : null,
    gap: hero && cats ? Math.round(cats.getBoundingClientRect().top - hero.getBoundingClientRect().bottom) : null,
    shadeBg: ss ? ss.backgroundImage.slice(0, 120) : null,
  };
});
console.log(JSON.stringify(info, null, 2));
await page.locator(".categories-section").screenshot({ path: "artifacts/web-ui-pass/p5-modes-stripe.png" });
const popular = page.locator(".catalog-section");
await popular.screenshot({ path: "artifacts/web-ui-pass/p5-popular-links.png" });
await page.locator(".hero").screenshot({ path: "artifacts/web-ui-pass/p5-hero-fade.png" });
await b.close();
