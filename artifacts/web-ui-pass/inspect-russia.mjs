import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:4173/russia-travel", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
const info = await page.evaluate(() => {
  const cards = [...document.querySelectorAll("[class*='deck'], [class*='route'], [class*='card'], article, .game-page__deck")].slice(0, 8).map(el => ({
    cls: el.className?.toString?.().slice(0,120),
    bg: getComputedStyle(el).backgroundColor,
    img: getComputedStyle(el).backgroundImage.slice(0,100),
  }));
  const titles = [...document.querySelectorAll("h1,h2,h3,p")].filter(el => /Города России|Маршруты|Где мы/.test(el.textContent||"")).map(el => ({
    tag: el.tagName, cls: el.className, text: el.textContent.trim().slice(0,40),
    bg: getComputedStyle(el).backgroundColor,
    parentBg: el.parentElement ? getComputedStyle(el.parentElement).backgroundColor : null,
    parentCls: el.parentElement?.className?.toString?.().slice(0,80),
  }));
  const back = [...document.querySelectorAll("button,a")].find(el => /Назад/.test(el.textContent||""));
  const how = document.querySelector("[class*='how'], [class*='hint'], [class*='lead'], [class*='banner']");
  return {
    cards,
    titles,
    back: back && { cls: back.className, bg: getComputedStyle(back).backgroundColor, img: getComputedStyle(back).backgroundImage.slice(0,80), radius: getComputedStyle(back).borderRadius },
    how: how && { cls: how.className, bg: getComputedStyle(how).backgroundColor },
    bodySnippet: document.querySelector(".game-page, .russia-travel, main")?.className,
    htmlSample: document.querySelector(".game-page, [class*='russia']")?.innerHTML?.slice(0, 1500),
  };
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: "artifacts/web-ui-pass/russia-inspect.png" });
await browser.close();
