import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:4173/comics", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const info = await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((el) => /Назад/.test(el.textContent || ""));
  const nodes = [];
  const walk = (el, depth = 0) => {
    if (!el || depth > 4) return;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    nodes.push({
      depth,
      tag: el.tagName,
      cls: el.className?.toString?.().slice(0, 80),
      bg: cs.backgroundColor,
      img: cs.backgroundImage.slice(0, 120),
      radius: cs.borderRadius,
      filter: cs.backdropFilter || cs.webkitBackdropFilter,
      clip: cs.backgroundClip,
      mask: cs.webkitMaskImage || cs.maskImage,
      mix: cs.mixBlendMode,
      opacity: cs.opacity,
      w: Math.round(r.width),
      h: Math.round(r.height),
      x: Math.round(r.x),
      y: Math.round(r.y),
    });
    [...el.children].forEach((c) => walk(c, depth + 1));
  };
  walk(btn);
  return nodes;
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
