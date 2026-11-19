import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });

async function shot(path, file, clipFn) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://127.0.0.1:4173" + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  if (clipFn) await clipFn(page);
  await page.screenshot({ path: file });
  await page.close();
}

await shot("/", "artifacts/web-ui-pass/fix-home-start.png", async (page) => {
  const box = await page.locator(".hero-play").boundingBox();
  if (box) await page.screenshot({ path: "artifacts/web-ui-pass/fix-start-crop.png", clip: { x: Math.max(0, box.x - 12), y: Math.max(0, box.y - 12), width: box.width + 24, height: box.height + 24 } });
});
await shot("/russia-travel", "artifacts/web-ui-pass/fix-russia.png");
await shot("/play/aboutUs", "artifacts/web-ui-pass/fix-play.png", async (page) => {
  await page.evaluate(() => document.querySelector(".play-page__actions")?.scrollIntoView({ block: "end" }));
  await page.waitForTimeout(250);
  const fav = await page.locator(".play-page__fav-btn").boundingBox();
  if (fav) await page.screenshot({ path: "artifacts/web-ui-pass/fix-fav-crop.png", clip: { x: Math.max(0, fav.x - 16), y: Math.max(0, fav.y - 16), width: Math.min(820, fav.width + 420), height: 140 } });
});

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:4173/play/aboutUs", { waitUntil: "networkidle" });
const styles = await page.evaluate(() => {
  const fav = document.querySelector(".play-page__fav-btn");
  const prev = document.querySelector(".play-page__prev-btn");
  const cs = (el) => el && ({ bg: getComputedStyle(el).backgroundColor, img: getComputedStyle(el).backgroundImage, radius: getComputedStyle(el).borderRadius, shadow: getComputedStyle(el).boxShadow });
  return { fav: cs(fav), prev: cs(prev) };
});
console.log(JSON.stringify(styles, null, 2));
await browser.close();
