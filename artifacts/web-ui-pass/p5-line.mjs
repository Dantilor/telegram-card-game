import { chromium } from "playwright";
const b = await chromium.launch({ channel: "msedge", headless: true });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
await page.waitForSelector(".catalog-section");
const info = await page.evaluate(() => {
  const cats = document.querySelector(".categories-section");
  const catalog = document.querySelector(".catalog-section");
  const moods = document.querySelector(".moods");
  const hero = document.querySelector(".hero");
  const art = document.querySelector(".hero-art");
  const shade = document.querySelector(".hero-shade");
  const pick = (el) => {
    if (!el) return null;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      tag: el.className,
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      borderTop: s.borderTop,
      borderBottom: s.borderBottom,
      outline: s.outline,
      boxShadow: s.boxShadow,
      bg: s.backgroundImage !== "none" ? s.backgroundImage.slice(0, 80) : s.backgroundColor,
      padB: s.paddingBottom,
      marginB: s.marginBottom,
      marginT: s.marginTop,
    };
  };
  // scan for thin horizontal borders near catalog top
  const catalogTop = catalog.getBoundingClientRect().top;
  const suspects = [];
  for (const el of document.querySelectorAll(".gnh-home-ref *")) {
    const r = el.getBoundingClientRect();
    if (r.width < 400 || r.height > 8) continue;
    if (Math.abs(r.top - catalogTop) > 40 && Math.abs(r.bottom - catalogTop) > 40) continue;
    const s = getComputedStyle(el);
    suspects.push({
      cls: el.className?.toString?.().slice(0, 60),
      t: Math.round(r.top),
      h: Math.round(r.height),
      w: Math.round(r.width),
      border: s.border,
      bg: s.backgroundColor,
    });
  }
  return {
    cats: pick(cats),
    moods: pick(moods),
    catalog: pick(catalog),
    hero: pick(hero),
    art: pick(art),
    shade: pick(shade),
    suspects,
  };
});
console.log(JSON.stringify(info, null, 2));
await b.close();
