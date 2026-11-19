import { chromium } from "playwright";
const b = await chromium.launch({ channel: "msedge", headless: true });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:4173/alias", { waitUntil: "networkidle" });
await page.waitForSelector(".alias-page__section-title");
const hasInside = await page.evaluate(() => !!document.querySelector(".gnh-inside"));
const spacing = await page.evaluate(() => {
  const sections = [...document.querySelectorAll(".alias-home__section, .alias-page__section")];
  const gaps = [];
  for (let i = 0; i < sections.length - 1; i++) {
    const a = sections[i].getBoundingClientRect();
    const b = sections[i + 1].getBoundingClientRect();
    const title = sections[i].querySelector("h2, .alias-page__section-title, .teams-setup__title");
    const hint = sections[i].querySelector(".alias-home__category-hint");
    gaps.push({
      from: title?.textContent?.trim().slice(0, 36),
      to: sections[i + 1].querySelector("h2")?.textContent?.trim().slice(0, 36),
      gapPx: Math.round(b.top - a.bottom),
      marginBottom: getComputedStyle(sections[i]).marginBottom,
      titleMb: title ? getComputedStyle(title).marginBottom : null,
      hintMb: hint ? getComputedStyle(hint).marginBottom : null,
    });
  }
  return gaps;
});
console.log("hasInside", hasInside);
console.log(JSON.stringify(spacing, null, 2));

// dirty the form so exit confirm shows
await page.locator(".alias-page__chip, .alias-home__chip").nth(1).click().catch(() => null);
await page.locator("button", { hasText: "45 сек" }).click().catch(() => null);
await page.locator(".alias-page__back").click();
await page.waitForSelector(".game-page__modal", { timeout: 4000 });
const modal = await page.evaluate(() => {
  const el = document.querySelector(".game-page__modal");
  const overlay = document.querySelector(".game-page__modal-overlay");
  if (!el) return null;
  const s = getComputedStyle(el);
  const o = overlay ? getComputedStyle(overlay, "::before") : null;
  const r = el.getBoundingClientRect();
  return {
    w: Math.round(r.width),
    h: Math.round(r.height),
    radius: s.borderRadius,
    pad: s.padding,
    bg: s.backgroundImage.slice(0, 120),
    border: s.border,
    shadow: s.boxShadow.slice(0, 120),
    overlayBlur: o?.backdropFilter || o?.webkitBackdropFilter || null,
  };
});
console.log("MODAL", JSON.stringify(modal, null, 2));
await page.locator(".game-page__modal").screenshot({ path: "artifacts/web-ui-pass/p5-modal.png" });
await page.screenshot({ path: "artifacts/web-ui-pass/p5-alias-spacing.png", clip: { x: 300, y: 180, width: 900, height: 480 } });

// quiz spacing check
const quiz = await b.newPage({ viewport: { width: 1440, height: 900 } });
await quiz.goto("http://127.0.0.1:4173/quiz", { waitUntil: "networkidle" });
const quizGaps = await quiz.evaluate(() => {
  const sections = [...document.querySelectorAll(".quiz-home__section, .game-page__section")];
  return sections.slice(0, 4).map((el, i, arr) => {
    const next = arr[i + 1];
    const a = el.getBoundingClientRect();
    const b = next?.getBoundingClientRect();
    return {
      title: el.querySelector("h2")?.textContent?.trim().slice(0, 40),
      mb: getComputedStyle(el).marginBottom,
      gap: next ? Math.round(b.top - a.bottom) : null,
    };
  });
});
console.log("QUIZ", JSON.stringify(quizGaps, null, 2));
await quiz.close();
await b.close();
