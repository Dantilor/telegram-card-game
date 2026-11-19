import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.getByRole("button", { name: /Premium|Тарифы/ }).first().click();
await page.waitForTimeout(600);
const home = await page.evaluate(() => {
  const dock = document.querySelector(".premium-overlay__dock");
  const comic = [...document.querySelectorAll(".premium-overlay__include-text")].find((el) => /мини/.test(el.textContent || ""));
  const cs = dock && getComputedStyle(dock);
  return {
    dockBg: cs?.backgroundColor,
    dockImg: cs?.backgroundImage,
    dockW: dock && Math.round(dock.getBoundingClientRect().width),
    cardW: Math.round(document.querySelector(".premium-overlay__card")?.getBoundingClientRect().width || 0),
    comicText: comic?.textContent,
    comicFull: comic ? comic.scrollHeight <= comic.clientHeight + 1 : null,
  };
});
await page.screenshot({ path: "artifacts/web-ui-pass/premium-fixed.png" });
console.log("home", JSON.stringify(home, null, 2));

// open from games (inside shell)
await page.goto("http://127.0.0.1:4173/games", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
const opened = await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button, a")].find((el) => /Premium|Тарифы/.test(el.textContent || ""));
  btn?.click();
  return !!btn;
});
await page.waitForTimeout(700);
const inside = await page.evaluate(() => {
  const card = document.querySelector(".premium-overlay__card");
  const dock = document.querySelector(".premium-overlay__dock");
  const cs = card && getComputedStyle(card);
  return {
    opened: !!card,
    display: cs?.display,
    cols: cs?.gridTemplateColumns,
    w: card && Math.round(card.getBoundingClientRect().width),
    dockBg: dock && getComputedStyle(dock).backgroundColor,
    dockImg: dock && getComputedStyle(dock).backgroundImage,
  };
});
console.log("inside", JSON.stringify(inside, null, 2));
if (inside.opened) await page.screenshot({ path: "artifacts/web-ui-pass/premium-inside-fixed.png" });

// transition flash check
const flashes = [];
page.on("framenavigated", () => {});
await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
await page.click('a[href="/games"]');
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(40);
  const state = await page.evaluate(() => ({
    skeleton: !!document.querySelector(".page-loading-skeleton"),
    skeletonDisplay: document.querySelector(".page-loading-skeleton") ? getComputedStyle(document.querySelector(".page-loading-skeleton")).display : null,
    path: location.pathname,
    hasGames: !!document.querySelector(".games-page"),
  }));
  flashes.push(state);
}
console.log("transition", JSON.stringify(flashes, null, 2));
await browser.close();
