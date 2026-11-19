import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
const dir = "artifacts/web-ui-pass";
await mkdir(dir, { recursive: true });
const b = await chromium.launch({ channel: "msedge", headless: true });
const notes = [];
async function shot(page, name) {
  await page.screenshot({ path: `${dir}/${name}.png` });
}
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const hero = await page.evaluate(() => {
  const art = document.querySelector(".hero-art");
  const before = art ? getComputedStyle(art, "::before") : null;
  const ar = art?.getBoundingClientRect();
  return {
    art: ar ? { w: Math.round(ar.width), h: Math.round(ar.height), x: Math.round(ar.x) } : null,
    before: before ? { w: before.width, h: before.height, content: before.content.slice(0, 40) } : null,
    bgSize: art ? getComputedStyle(art).backgroundSize : null,
  };
});
notes.push("hero " + JSON.stringify(hero));
await shot(page, "portal-desk");
const premium = page.locator(".game-card", { hasText: "Ассоциации" }).locator(".game-open");
await premium.click();
await page.waitForTimeout(400);
const modal = await page.evaluate(() => {
  const card = document.querySelector(".premium-overlay__card");
  const overlay = document.querySelector(".premium-overlay");
  const r = card?.getBoundingClientRect();
  return {
    url: location.pathname,
    overlayClass: overlay?.className || null,
    title: document.querySelector(".premium-overlay__heading-text")?.textContent || null,
    tagline: document.querySelector(".premium-overlay__tagline-text")?.textContent?.trim() || null,
    benefits: [...document.querySelectorAll(".premium-overlay__include-title")].map((n) => n.textContent),
    card: r ? { w: Math.round(r.width), h: Math.round(r.height) } : null,
    plans: document.querySelectorAll(".premium-overlay__plan").length,
  };
});
notes.push("modal " + JSON.stringify(modal));
await shot(page, "premium-from-card");
await page.locator(".premium-overlay__close").click();
await page.waitForTimeout(200);
const free = page.locator(".game-card", { hasText: "Двойники" }).locator(".game-open");
await free.click();
await page.waitForTimeout(500);
notes.push("free url " + page.url());
await page.goto("http://127.0.0.1:4173/games", { waitUntil: "networkidle" });
await page.waitForTimeout(300);
const locked = page.locator(".games-grid__card", { hasText: "PREMIUM" }).first();
const lockedTitle = await locked.locator("h3, h2, .games-grid__title").first().textContent().catch(() => "");
notes.push("catalog locked title " + (lockedTitle || "").trim());
await locked.click();
await page.waitForTimeout(400);
const modal2 = await page.evaluate(() => {
  const card = document.querySelector(".premium-overlay__card");
  const overlay = document.querySelector(".premium-overlay");
  const r = card?.getBoundingClientRect();
  return {
    url: location.pathname,
    overlayClass: overlay?.className || null,
    title: document.querySelector(".premium-overlay__heading-text")?.textContent || null,
    card: r ? { w: Math.round(r.width), h: Math.round(r.height) } : null,
    grid: getComputedStyle(card).display,
  };
});
notes.push("catalog modal " + JSON.stringify(modal2));
await shot(page, "premium-from-catalog");
const phone = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await phone.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
await phone.waitForTimeout(400);
const phoneHero = await phone.evaluate(() => {
  const art = document.querySelector(".hero-art");
  const ar = art?.getBoundingClientRect();
  const cs = art ? getComputedStyle(art) : null;
  return {
    art: ar ? { w: Math.round(ar.width), h: Math.round(ar.height) } : null,
    bgSize: cs?.backgroundSize,
    bgPos: cs?.backgroundPosition,
  };
});
notes.push("phone hero " + JSON.stringify(phoneHero));
await phone.screenshot({ path: `${dir}/portal-phone.png` });
console.log(notes.join("\n"));
await b.close();
