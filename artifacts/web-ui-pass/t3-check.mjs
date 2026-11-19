import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const shots = [
  ["profile", 1440, 900, "/profile"],
  ["profile", 768, 900, "/profile"],
  ["profile", 390, 844, "/profile"],
  ["premium", 1440, 900, "/premium"],
  ["premium", 768, 900, "/premium"],
  ["premium", 390, 844, "/premium"],
];
const out = {};
for (const [name, w, h, path] of shots) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto("http://127.0.0.1:4173" + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const key = name + w;
  out[key] = await page.evaluate(() => {
    const scroller = document.querySelector(".gnh-inside") || document.documentElement;
    const pageEl = document.querySelector(".profile-page, .premium-page, .premium-screen");
    const grid = document.querySelector(".profile-grid, .premium-layout");
    const cols = grid ? getComputedStyle(grid).gridTemplateColumns : "";
    const box = pageEl ? pageEl.getBoundingClientRect() : null;
    return {
      path: location.pathname,
      overflow: scroller.scrollWidth - scroller.clientWidth,
      cols,
      width: box ? Math.round(box.width) : null,
      title: document.querySelector("h1, h2")?.textContent?.slice(0, 80) || null,
      reconnect: document.body.innerText.includes("Восстанавливаем соединение"),
      loadingDup: (document.body.innerText.match(/Загрузка/g) || []).length,
      emailTitle: document.body.innerText.includes("Почта и восстановление доступа"),
      oldTitle: document.body.innerText.includes("Защита покупки"),
    };
  });
  await page.screenshot({ path: `artifacts/web-ui-pass/t3-${name}-${w}.png`, fullPage: false });
  await page.close();
}
const overlay = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await overlay.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
await overlay.getByRole("button", { name: /Тарифы|Premium/ }).first().click();
await overlay.waitForTimeout(500);
const card = await overlay.evaluate(() => {
  const el = document.querySelector(".premium-overlay__card");
  const dock = document.querySelector(".premium-overlay__dock");
  const box = el?.getBoundingClientRect();
  const dockBox = dock?.getBoundingClientRect();
  const view = window.innerHeight;
  return {
    cardW: box ? Math.round(box.width) : null,
    cardH: box ? Math.round(box.height) : null,
    dockVisible: dockBox ? dockBox.bottom <= view + 2 && dockBox.top >= 0 : false,
    close: !!document.querySelector(".premium-overlay__close"),
  };
});
await overlay.screenshot({ path: "artifacts/web-ui-pass/t3-overlay-1440.png" });
const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
await phone.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
await phone.locator(".premium-button, .menu-button").first().click();
await phone.waitForTimeout(300);
const opened = await phone.locator(".premium-overlay").count();
if (!opened) {
  const menuPremium = phone.getByRole("link", { name: /Premium|Тарифы/ });
  if (await menuPremium.count()) await menuPremium.first().click();
  await phone.waitForTimeout(400);
}
const phoneCard = await phone.evaluate(() => {
  const el = document.querySelector(".premium-overlay__card");
  const box = el?.getBoundingClientRect();
  return { cardW: box ? Math.round(box.width) : null, view: window.innerWidth, open: !!el };
});
await phone.screenshot({ path: "artifacts/web-ui-pass/t3-overlay-390.png" });
console.log(JSON.stringify({ out, overlay: card, phoneCard }, null, 2));
await browser.close();
