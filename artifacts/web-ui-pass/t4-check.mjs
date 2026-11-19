import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });

async function open(path, w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto("http://127.0.0.1:4173" + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  return page;
}

function measureMode() {
  const page = document.querySelector(".deck-select-page");
  const link = document.querySelector(".deck-select-page__card-link");
  const title = document.querySelector(".deck-select-page__card-title");
  const desc = document.querySelector(".deck-select-page__card-desc");
  const chip = document.querySelector(".deck-select-page__chip");
  const meta = document.querySelector(".deck-select-page__card-meta");
  const h1 = document.querySelector(".deck-select-page .games-page-header__title");
  const pr = page ? page.getBoundingClientRect() : null;
  const lr = link ? link.getBoundingClientRect() : null;
  const tr = title ? title.getBoundingClientRect() : null;
  const mr = meta ? meta.getBoundingClientRect() : null;
  return {
    pageW: pr ? Math.round(pr.width) : null,
    rowH: lr ? Math.round(lr.height) : null,
    titleSize: title ? getComputedStyle(title).fontSize : null,
    descSize: desc ? getComputedStyle(desc).fontSize : null,
    h1: h1 ? getComputedStyle(h1).fontSize : null,
    chip: chip ? Math.round(chip.getBoundingClientRect().width) : null,
    metaRight: mr && lr ? Math.round(lr.right - mr.right) < 30 && mr.left > (tr ? tr.right - 4 : 0) : null,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
}

function measurePlay() {
  const page = document.querySelector(".play-page");
  const card = document.querySelector(".play-card");
  const text = document.querySelector(".play-card__text");
  const bar = document.querySelector(".play-page__progress-bar");
  const cta = document.querySelector(".play-page__cta");
  const fav = document.querySelector(".play-page__fav-btn");
  const prev = document.querySelector(".play-page__prev-btn");
  const h = (el) => (el ? Math.round(el.getBoundingClientRect().height) : null);
  const w = (el) => (el ? Math.round(el.getBoundingClientRect().width) : null);
  return {
    pageW: w(page),
    cardW: w(card),
    cardH: h(card),
    text: text ? getComputedStyle(text).fontSize : null,
    textSample: text ? text.textContent.slice(0, 80) : null,
    barH: h(bar),
    ctaH: h(cta),
    favH: h(fav),
    prevH: h(prev),
    ctaR: cta ? getComputedStyle(cta).borderRadius : null,
    prevR: prev ? getComputedStyle(prev).borderRadius : null,
    labels: [cta, fav, prev].map((el) => (el ? el.textContent.trim() : null)),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
}

function measureQuiz() {
  const page = document.querySelector(".quiz-home");
  const cat = document.querySelector(".quiz-home__categories");
  const card = document.querySelector(".quiz-home__category-card");
  const chip = document.querySelector(".game-page__chip");
  const cta = document.querySelector(".quiz-home .game-page__cta, .quiz-home .alias-home__start, .quiz-home button.game-page__cta");
  const start = document.querySelector(".quiz-home .game-page__actions button");
  const cols = cat ? getComputedStyle(cat).gridTemplateColumns : null;
  return {
    pageW: page ? Math.round(page.getBoundingClientRect().width) : null,
    cols,
    catH: card ? Math.round(card.getBoundingClientRect().height) : null,
    chipH: chip ? Math.round(chip.getBoundingClientRect().height) : null,
    startW: start ? Math.round(start.getBoundingClientRect().width) : null,
    startH: start ? Math.round(start.getBoundingClientRect().height) : null,
    title: document.querySelector(".games-page-header__title")?.textContent || null,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
}

const out = {};
for (const [name, path, fn] of [
  ["mode1440", "/mode/couples", measureMode],
  ["mode390", "/mode/couples", measureMode],
  ["play1440", "/play/aboutUs", measurePlay],
  ["play390", "/play/aboutUs", measurePlay],
  ["quiz1440", "/quiz", measureQuiz],
  ["quiz390", "/quiz", measureQuiz],
]) {
  const w = name.endsWith("390") ? 390 : 1440;
  const h = name.endsWith("390") ? 844 : 900;
  const page = await open(path, w, h);
  if (name.startsWith("mode")) await page.waitForSelector(".deck-select-page__card-link", { timeout: 8000 });
  if (name.startsWith("play")) await page.waitForSelector(".play-card__text", { timeout: 8000 });
  if (name.startsWith("quiz")) await page.waitForSelector(".quiz-home", { timeout: 8000 });
  out[name] = await page.evaluate(fn);
  await page.screenshot({ path: "artifacts/web-ui-pass/t4-" + name + ".png", fullPage: false });
  await page.close();
}
console.log(JSON.stringify(out, null, 2));
await browser.close();
