import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
const routes = ["/", "/games", "/comics", "/profile", "/games", "/"];
const bad = [];
for (let i = 0; i < routes.length - 1; i++) {
  const from = routes[i];
  const to = routes[i + 1];
  if (page.url().endsWith(from) === false && from !== "/") {
    await page.goto("http://127.0.0.1:4173" + from, { waitUntil: "networkidle" });
  }
  const navPromise = page.evaluate((href) => {
    const a = document.querySelector(`a[href="${href}"]`);
    if (a) a.click();
    else location.href = href;
  }, to);
  const seen = [];
  for (let t = 0; t < 12; t++) {
    await page.waitForTimeout(25);
    const snap = await page.evaluate(() => document.body.innerText.includes("Загружаем"));
    if (snap) seen.push(t);
  }
  await navPromise.catch(()=>{});
  await page.waitForTimeout(200);
  if (seen.length) bad.push({ from, to, frames: seen });
}
console.log(JSON.stringify({ bad, ok: bad.length === 0 }, null, 2));
await browser.close();
