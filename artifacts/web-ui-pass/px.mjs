import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:4173/play/aboutUs", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.evaluate(() => document.querySelector(".play-page__actions")?.scrollIntoView({ block: "end" }));
await page.waitForTimeout(200);
const sample = await page.evaluate(async () => {
  const fav = document.querySelector(".play-page__fav-btn");
  const r = fav.getBoundingClientRect();
  // sample center of button vs outside below
  const points = [
    [r.x + r.width / 2, r.y + r.height / 2],
    [r.x + 30, r.y + r.height / 2],
    [r.x + r.width / 2, r.y - 20],
  ];
  // use screenshot pixels via canvas draw of region - simpler: computed styles of children
  const kids = [...fav.childNodes].map((n) => {
    if (n.nodeType === 3) return { type: "text", text: n.textContent };
    const el = n;
    const cs = getComputedStyle(el);
    return { type: "el", tag: el.tagName, cls: el.className, bg: cs.backgroundColor, filter: cs.filter, shadow: cs.textShadow, color: cs.color };
  });
  return {
    btn: { bg: getComputedStyle(fav).backgroundColor, filter: getComputedStyle(fav).filter, mix: getComputedStyle(fav).mixBlendMode },
    kids,
    html: fav.innerHTML,
  };
});
console.log(JSON.stringify(sample, null, 2));
await browser.close();
