import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.getByRole("button", { name: /Premium|Тарифы/ }).first().click();
await page.waitForTimeout(700);
const info = await page.evaluate(() => {
  const card = document.querySelector(".premium-overlay__card");
  const dock = document.querySelector(".premium-overlay__dock");
  const texts = [...document.querySelectorAll(".premium-overlay__include-text")].map((el) => {
    const cs = getComputedStyle(el);
    return {
      text: el.textContent?.slice(0, 90),
      clamp: cs.webkitLineClamp,
      overflow: cs.overflow,
      display: cs.display,
      maxH: cs.maxHeight,
      h: Math.round(el.getBoundingClientRect().height),
      full: el.scrollHeight > el.clientHeight + 2,
    };
  });
  const dockCs = dock && getComputedStyle(dock);
  const cardCs = card && getComputedStyle(card);
  return {
    cardDisplay: cardCs?.display,
    cardCols: cardCs?.gridTemplateColumns,
    cardW: card && Math.round(card.getBoundingClientRect().width),
    dockBg: dockCs?.backgroundImage?.slice(0, 120) || dockCs?.backgroundColor,
    dockW: dock && Math.round(dock.getBoundingClientRect().width),
    dockGridCol: dockCs?.gridColumn,
    texts,
  };
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: "artifacts/web-ui-pass/premium-broken.png" });
await browser.close();
