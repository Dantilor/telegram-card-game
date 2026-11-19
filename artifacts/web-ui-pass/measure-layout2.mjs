import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const widths = [1920, 1440, 768, 390];
const out = {};
for (const width of widths) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
  out["home"+width] = await page.evaluate(() => {
    const scroller = document.querySelector(".gnh-home-scroll");
    const h1 = document.querySelector(".hero h1");
    const h2 = document.querySelector(".section-heading h2");
    const title = document.querySelector(".game-title");
    const cols = getComputedStyle(document.querySelector(".game-grid")).gridTemplateColumns.split(" ").length;
    const nav = getComputedStyle(document.querySelector(".desktop-nav")).display;
    return {
      overflow: scroller.scrollWidth - scroller.clientWidth,
      h1x: Math.round(h1.getBoundingClientRect().x),
      h2x: Math.round(h2.getBoundingClientRect().x),
      h1: getComputedStyle(h1).fontSize,
      h2: getComputedStyle(h2).fontSize,
      title: getComputedStyle(title).fontSize,
      cols,
      nav,
      headerH: Math.round(document.querySelector(".site-header").getBoundingClientRect().height),
      innerW: Math.round(document.querySelector(".header-inner").getBoundingClientRect().width),
    };
  });
  if (width === 1440 || width === 768) await page.screenshot({ path: `artifacts/web-ui-pass/layout2-home-${width}.png` });
  await page.goto("http://127.0.0.1:4173/games", { waitUntil: "networkidle" });
  out["games"+width] = await page.evaluate(() => {
    const scroller = document.querySelector(".gnh-inside");
    const title = document.querySelector(".games-grid__title");
    const pageTitle = document.querySelector(".games-page-header__title");
    const nav = document.querySelector(".bottom-nav");
    const nr = nav ? nav.getBoundingClientRect() : null;
    return {
      overflow: scroller.scrollWidth - scroller.clientWidth,
      title: title ? getComputedStyle(title).fontSize : null,
      pageTitle: pageTitle ? getComputedStyle(pageTitle).fontSize : null,
      navRight: nr ? Math.round(nr.right) : null,
      contentW: Math.round(document.querySelector(".content").getBoundingClientRect().width),
    };
  });
  await page.close();
}
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Ассоциации", exact: true }).click();
await page.waitForTimeout(500);
out.alias = page.url();
await browser.close();
console.log(JSON.stringify(out, null, 2));
