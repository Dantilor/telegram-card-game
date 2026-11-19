import { chromium } from "playwright";
import fs from "fs";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const out = {};

async function shot(path, w, h, file, scrollSel, extra) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto("http://127.0.0.1:4173" + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  if (scrollSel) {
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      const scroller = document.querySelector(".gnh-home-scroll") || document.querySelector(".gnh-inside") || document.scrollingElement;
      if (el && scroller) {
        const top = el.getBoundingClientRect().top + scroller.scrollTop - 40;
        scroller.scrollTo({ top, behavior: "instant" });
      }
    }, scrollSel);
    await page.waitForTimeout(350);
  }
  if (extra) await extra(page);
  const info = await page.evaluate(() => {
    const why = document.querySelector(".why-section");
    const lead = document.querySelector(".why-lead");
    const cards = [...document.querySelectorAll(".why-card")].map((c) => ({
      h: c.querySelector("h3")?.textContent?.trim(),
      icon: !!c.querySelector(".why-card__icon"),
    }));
    const comicBadges = [...document.querySelectorAll(".comics-grid__card .games-card-badge")].slice(0, 3).map((b) => {
      const r = b.getBoundingClientRect();
      const media = b.closest(".comics-grid__card")?.querySelector(".comics-grid__media")?.getBoundingClientRect();
      return {
        text: b.textContent?.trim(),
        inBody: !!b.closest(".comics-grid__body"),
        top: Math.round(r.top),
        mediaBottom: media ? Math.round(media.bottom) : null,
      };
    });
    const fav = document.querySelector(".play-page__fav-btn, .game-page__btn--secondary");
    const prev = document.querySelector(".play-page__prev-btn");
    const back = document.querySelector(".btn.btn--ghost, .home-btn, [class$='__back']");
    const cs = (el) => (el ? getComputedStyle(el) : null);
    return {
      whyTitle: document.querySelector("#gnh-why-title")?.textContent?.trim() || null,
      lead: lead?.textContent?.trim() || null,
      cards,
      whyCols: why ? getComputedStyle(document.querySelector(".why-grid")).gridTemplateColumns.split(" ").length : null,
      comicBadges,
      favBg: cs(fav)?.backgroundImage || cs(fav)?.backgroundColor,
      favRadius: cs(fav)?.borderRadius,
      prevBg: cs(prev)?.backgroundImage || cs(prev)?.backgroundColor,
      backBg: cs(back)?.backgroundImage || cs(back)?.backgroundColor,
      backRadius: cs(back)?.borderRadius,
    };
  });
  await page.screenshot({ path: file, fullPage: false });
  await page.close();
  return info;
}

out.why1440 = await shot("/", 1440, 900, "artifacts/web-ui-pass/why-1440.png", ".why-section");
out.why390 = await shot("/", 390, 844, "artifacts/web-ui-pass/why-390.png", ".why-section");
out.modes1440 = await shot("/", 1440, 900, "artifacts/web-ui-pass/modes-stripe-1440.png", ".categories-section");
out.comics1440 = await shot("/comics", 1440, 900, "artifacts/web-ui-pass/comics-1440.png", null);
out.games1440 = await shot("/games", 1440, 900, "artifacts/web-ui-pass/games-hero-1440.png", null);
out.play1440 = await shot("/play/aboutUs", 1440, 900, "artifacts/web-ui-pass/play-btns-1440.png", null, async (page) => {
  await page.evaluate(() => {
    const el = document.querySelector(".play-page__fav-btn, .play-page__actions, .game-page__actions");
    el?.scrollIntoView({ block: "end" });
  });
  await page.waitForTimeout(300);
});

console.log(JSON.stringify(out, null, 2));
await browser.close();
