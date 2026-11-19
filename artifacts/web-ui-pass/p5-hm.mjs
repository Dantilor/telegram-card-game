import { chromium } from "playwright";
const b = await chromium.launch({ channel: "msedge", headless: true });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
await page.waitForSelector(".moods");
await page.screenshot({ path: "artifacts/web-ui-pass/p5-hero-modes-now.png", clip: { x: 0, y: 60, width: 1440, height: 520 } });
await b.close();
console.log("ok");
