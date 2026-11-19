import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const home = await page.evaluate(() => {
  const span = document.querySelector(".gnh-home-ref .brand > span");
  const cs = span && getComputedStyle(span);
  return { text: span?.textContent, bg: cs?.backgroundImage, color: cs?.color, fill: cs?.webkitTextFillColor, weight: cs?.fontWeight, size: cs?.fontSize };
});
await page.goto("http://127.0.0.1:4173/games", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const inside = await page.evaluate(() => {
  const brand = document.querySelector(".gnh-inside .brand");
  const span = brand?.querySelector("span");
  const cs = (span || brand) && getComputedStyle(span || brand);
  return { html: brand?.innerHTML?.slice(0, 300), text: (span || brand)?.textContent?.trim(), bg: cs?.backgroundImage, color: cs?.color, fill: cs?.webkitTextFillColor, weight: cs?.fontWeight, size: cs?.fontSize };
});
console.log(JSON.stringify({ home, inside }, null, 2));
await page.screenshot({ path: "artifacts/web-ui-pass/brand-home.png", clip: { x: 0, y: 0, width: 420, height: 90 } });
await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
await page.waitForTimeout(300);
await page.screenshot({ path: "artifacts/web-ui-pass/brand-home2.png", clip: { x: 0, y: 0, width: 420, height: 90 } });
await browser.close();
