import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
await page.waitForTimeout(300);
const frames = [];
const click = page.click('a[href="/games"], a.nav-link[data-nav="catalog"], .desktop-nav a[href="/games"]');
for (let i = 0; i < 15; i++) {
  await page.waitForTimeout(30);
  frames.push(await page.evaluate(() => ({
    path: location.pathname,
    skeleton: !!document.querySelector(".page-loading-skeleton, .page-loading"),
    skeletonVisible: (() => {
      const el = document.querySelector(".page-loading-skeleton, .page-loading");
      if (!el) return false;
      const cs = getComputedStyle(el);
      return cs.display !== "none" && cs.visibility !== "hidden" && cs.opacity !== "0";
    })(),
    hasGames: !!document.querySelector(".games-page"),
    hasHome: !!document.querySelector(".gnh-home-ref"),
    hasInside: !!document.querySelector(".gnh-inside"),
    bodyText: document.body.innerText.slice(0, 40),
  })));
}
await click.catch(()=>{});
console.log(JSON.stringify(frames, null, 2));
await browser.close();
