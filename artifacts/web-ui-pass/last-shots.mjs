import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.evaluate(() => {
  const el = document.querySelector(".why-section");
  const scroller = document.querySelector(".gnh-home-scroll") || document.scrollingElement;
  if (el && scroller) scroller.scrollTo({ top: el.getBoundingClientRect().top + scroller.scrollTop - 36 });
});
await page.waitForTimeout(350);
await page.screenshot({ path: "artifacts/web-ui-pass/why-block-final.png" });

const comics = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await comics.goto("http://127.0.0.1:4173/comics", { waitUntil: "networkidle" });
await comics.waitForTimeout(500);
await comics.screenshot({ path: "artifacts/web-ui-pass/comics-block-final.png" });
await comics.screenshot({ path: "artifacts/web-ui-pass/back-btn-final.png", clip: { x: 90, y: 80, width: 160, height: 70 } });

const play = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await play.goto("http://127.0.0.1:4173/play/aboutUs", { waitUntil: "networkidle" });
await play.waitForTimeout(400);
await play.evaluate(() => document.querySelector(".play-page__actions")?.scrollIntoView({ block: "end" }));
await play.waitForTimeout(250);
await play.screenshot({ path: "artifacts/web-ui-pass/play-actions-final.png" });
await browser.close();
console.log("ok");
