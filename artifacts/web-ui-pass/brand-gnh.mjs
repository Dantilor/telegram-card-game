import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const text = await page.locator(".gnh-home-ref .brand > span").textContent();
await page.screenshot({ path: "artifacts/web-ui-pass/brand-gnh.png", clip: { x: 0, y: 0, width: 320, height: 90 } });
console.log(text);
await browser.close();
