import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });

async function go(path, w, h, file, scrollSel) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto("http://127.0.0.1:4173" + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  if (scrollSel) {
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      const scroller = document.querySelector(".gnh-home-scroll") || document.querySelector(".gnh-inside") || document.scrollingElement;
      if (el && scroller) {
        const top = el.getBoundingClientRect().top + scroller.scrollTop - 36;
        scroller.scrollTo({ top, behavior: "instant" });
      }
    }, scrollSel);
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: file });
  await page.close();
}

await go("/", 1440, 900, "artifacts/web-ui-pass/why-final-1440.png", ".why-section");
await go("/comics", 1440, 900, "artifacts/web-ui-pass/comics-final-1440.png");
await go("/games", 1440, 900, "artifacts/web-ui-pass/games-final-1440.png");
await go("/play/aboutUs", 1440, 900, "artifacts/web-ui-pass/play-final-1440.png");

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:4173/comics", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const btn = await page.evaluate(() => {
  const el = [...document.querySelectorAll("button")].find((b) => /Назад/.test(b.textContent || ""));
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return { x: r.x, y: r.y, w: r.width, h: r.height, bg: cs.backgroundColor, img: cs.backgroundImage };
});
await page.screenshot({ path: "artifacts/web-ui-pass/back-final-crop.png", clip: { x: 0, y: 70, width: 280, height: 100 } });
console.log("back", btn);

const play = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await play.goto("http://127.0.0.1:4173/play/aboutUs", { waitUntil: "networkidle" });
await play.waitForTimeout(400);
await play.evaluate(() => document.querySelector(".play-page__actions")?.scrollIntoView({ block: "end" }));
await play.waitForTimeout(200);
const fav = await play.evaluate(() => {
  const el = document.querySelector(".play-page__fav-btn");
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height, bg: getComputedStyle(el).backgroundColor };
});
await play.screenshot({ path: "artifacts/web-ui-pass/fav-final-crop.png", clip: { x: Math.max(0, fav.x - 20), y: Math.max(0, fav.y - 20), width: Math.min(900, fav.w + 40), height: 160 } });
console.log("fav", fav);

const comics = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await comics.goto("http://127.0.0.1:4173/comics", { waitUntil: "networkidle" });
await comics.waitForTimeout(400);
const meta = await comics.evaluate(() => {
  const card = document.querySelector(".comics-grid__card--locked") || document.querySelectorAll(".comics-grid__card")[3];
  const badge = card?.querySelector(".games-card-badge");
  const media = card?.querySelector(".comics-grid__media");
  const body = card?.querySelector(".comics-grid__body");
  const br = badge?.getBoundingClientRect();
  const mr = media?.getBoundingClientRect();
  const bodyR = body?.getBoundingClientRect();
  return {
    badgeText: badge?.textContent?.trim(),
    inBody: !!badge?.closest(".comics-grid__body"),
    badgeTop: br && Math.round(br.top),
    mediaTop: mr && Math.round(mr.top),
    mediaBottom: mr && Math.round(mr.bottom),
    bodyJustify: body && getComputedStyle(body).justifyContent,
    bodyPad: body && getComputedStyle(body).paddingTop,
    bodyTop: bodyR && Math.round(bodyR.top),
  };
});
console.log("comics", meta);
await browser.close();
