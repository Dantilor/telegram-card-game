import { chromium } from "playwright";
const b = await chromium.launch({ channel: "msedge", headless: true });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:4173/games", { waitUntil: "networkidle" });
await page.waitForSelector(".games-page__back, .hero-game-card");
const info = await page.evaluate(() => {
  const back = document.querySelector(".games-page__back");
  const tabs = document.querySelector(".catalog-tabs__group");
  const hero = document.querySelector(".hero-game-card");
  const img = document.querySelector(".hero-game-card .smart-image__img");
  const s = (el) => el ? getComputedStyle(el) : null;
  const bs = s(back); const ts = s(tabs); const hs = s(hero); const is = s(img);
  return {
    back: back ? {
      r: Math.round(back.getBoundingClientRect().width) + "x" + Math.round(back.getBoundingClientRect().height),
      radius: bs.borderRadius,
      backdrop: bs.backdropFilter,
      overflow: bs.overflow,
      bg: bs.backgroundImage.slice(0, 60),
    } : null,
    tabs: tabs ? {
      radius: ts.borderRadius,
      backdrop: ts.backdropFilter,
      overflow: ts.overflow,
      shadow: ts.boxShadow.slice(0, 80),
    } : null,
    hero: hero ? {
      h: Math.round(hero.getBoundingClientRect().height),
      w: Math.round(hero.getBoundingClientRect().width),
    } : null,
    img: img ? { fit: is.objectFit, pos: is.objectPosition } : null,
  };
});
console.log(JSON.stringify(info, null, 2));
await page.locator(".games-page__back").screenshot({ path: "artifacts/web-ui-pass/p6-back.png" });
await page.locator(".catalog-tabs__group").screenshot({ path: "artifacts/web-ui-pass/p6-tabs.png" });
await page.locator(".hero-game-card").first().screenshot({ path: "artifacts/web-ui-pass/p6-hero.png" });

const quiz = await b.newPage({ viewport: { width: 1440, height: 900 } });
await quiz.goto("http://127.0.0.1:4173/quiz", { waitUntil: "networkidle" });
await quiz.waitForSelector(".game-page__actions, .game-page__cta");
const qinfo = await quiz.evaluate(() => {
  const actions = document.querySelector(".game-page__actions");
  const cta = document.querySelector(".game-page__cta");
  const as = actions ? getComputedStyle(actions) : null;
  const cs = cta ? getComputedStyle(cta) : null;
  return {
    actionsBg: as ? as.backgroundImage + " | " + as.backgroundColor : null,
    actionsFilter: as ? as.backdropFilter : null,
    ctaRadius: cs ? cs.borderRadius : null,
    ctaOverflow: cs ? cs.overflow : null,
  };
});
console.log(JSON.stringify(qinfo, null, 2));
if (await quiz.locator(".game-page__actions").count()) {
  await quiz.locator(".game-page__actions").screenshot({ path: "artifacts/web-ui-pass/p6-cta.png" });
}
await b.close();
