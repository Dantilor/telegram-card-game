import { chromium } from "playwright";
const b = await chromium.launch({ channel: "msedge", headless: true });
const dir = "artifacts/web-ui-pass";
async function pageAt(path, w, h) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await p.goto("http://127.0.0.1:4173" + path, { waitUntil: "networkidle" });
  await p.waitForTimeout(500);
  return p;
}
const home = await pageAt("/", 1440, 900);
await home.waitForSelector(".mood");
const metrics = await home.evaluate(() => {
  const moods = [...document.querySelectorAll(".mood")].map((el) => Math.round(el.getBoundingClientRect().height));
  const brand = document.querySelector(".brand > span");
  const bs = brand ? getComputedStyle(brand) : null;
  const img = document.querySelector(".game-cover img");
  const is = img ? getComputedStyle(img) : null;
  const cat = document.querySelector(".categories-section");
  const cs = cat ? getComputedStyle(cat) : null;
  return {
    moodHeights: moods,
    brandClip: bs ? (bs.backgroundClip || bs.webkitBackgroundClip) : null,
    brandWeight: bs ? bs.fontWeight : null,
    imgFit: is ? is.objectFit : null,
    imgPos: is ? is.objectPosition : null,
    catBg: cs ? cs.backgroundColor : null,
  };
});
await home.screenshot({ path: dir + "/p5-hero-modes.png", clip: { x: 0, y: 0, width: 1440, height: 640 } });
await home.locator(".brand").screenshot({ path: dir + "/p5-wordmark.png" });
await home.locator("#gnh-popular-title").scrollIntoViewIfNeeded();
await home.waitForTimeout(250);
await home.screenshot({ path: dir + "/p5-popular.png" });
await home.locator("#gnh-why-title").scrollIntoViewIfNeeded();
await home.waitForTimeout(250);
await home.screenshot({ path: dir + "/p5-why.png" });
await home.close();

const phone = await pageAt("/", 390, 844);
await phone.waitForSelector(".mood");
await phone.screenshot({ path: dir + "/p5-hero-modes-390.png", clip: { x: 0, y: 0, width: 390, height: 780 } });
await phone.close();

const games = await pageAt("/games", 1440, 900);
await games.waitForTimeout(400);
await games.screenshot({ path: dir + "/p5-catalog.png" });
const badge = await games.evaluate(() => {
  const el = document.querySelector(".games-card-badge, .hero-game-card__badge");
  if (!el) return null;
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return { text: el.textContent.trim(), font: s.fontSize, pad: s.padding, h: Math.round(r.height), radius: s.borderRadius };
});
await games.close();

const mode = await pageAt("/mode/couples", 1440, 900);
const back = mode.locator(".deck-select-page__back, .back-btn").first();
await back.waitFor({ timeout: 8000 });
await back.screenshot({ path: dir + "/p5-back.png" });
const backStyle = await back.evaluate((el) => {
  const s = getComputedStyle(el);
  return { radius: s.borderRadius, h: Math.round(el.getBoundingClientRect().height), color: s.color };
});
await mode.close();

const quiz = await pageAt("/quiz", 1440, 900);
const cta = quiz.locator(".game-page__cta");
await cta.waitFor({ timeout: 8000 });
await cta.scrollIntoViewIfNeeded();
await quiz.waitForTimeout(200);
await cta.screenshot({ path: dir + "/p5-cta.png" });
const ctaStyle = await cta.evaluate((el) => {
  const s = getComputedStyle(el);
  return { h: Math.round(el.getBoundingClientRect().height), radius: s.borderRadius, weight: s.fontWeight, text: el.textContent.trim() };
});
await quiz.close();
console.log(JSON.stringify({ metrics, badge, backStyle, ctaStyle }, null, 2));
await b.close();
