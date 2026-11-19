import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
async function shot(w, h, file) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
  if (w < 700) {
    await page.locator(".menu-button").click();
    await page.waitForTimeout(200);
    const item = page.getByRole("button", { name: /Premium|Тарифы/ }).or(page.getByRole("link", { name: /Premium|Тарифы/ }));
    await item.first().click();
  } else {
    await page.locator(".premium-button").click();
  }
  await page.waitForTimeout(600);
  const info = await page.evaluate(() => {
    const card = document.querySelector(".premium-overlay__card");
    const dock = document.querySelector(".premium-overlay__dock");
    const email = document.querySelector(".premium-offer__field");
    const cb = card?.getBoundingClientRect();
    const db = dock?.getBoundingClientRect();
    const eb = email?.getBoundingClientRect();
    const scroll = document.querySelector(".premium-overlay__scroll");
    return {
      cardW: cb ? Math.round(cb.width) : null,
      cardH: cb ? Math.round(cb.height) : null,
      viewW: window.innerWidth,
      viewH: window.innerHeight,
      dockInView: db ? db.bottom <= window.innerHeight + 1 && db.top >= 0 : false,
      emailInScroll: !!scroll?.contains(email),
      emailCovered: eb && db ? eb.bottom > db.top && eb.top < db.bottom : null,
      close: !!document.querySelector(".premium-overlay__close"),
    };
  });
  await page.screenshot({ path: file });
  await page.close();
  return info;
}
const desk = await shot(1440, 900, "artifacts/web-ui-pass/t3-overlay-1440.png");
const phone = await shot(390, 844, "artifacts/web-ui-pass/t3-overlay-390.png");
console.log(JSON.stringify({ desk, phone }, null, 2));
await browser.close();
