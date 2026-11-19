import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:4173/comics", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
const comics = await page.evaluate(() => {
  const card = document.querySelector(".comics-grid__card");
  const media = card?.querySelector(".comics-grid__media");
  const body = card?.querySelector(".comics-grid__body");
  const badges = [...(card?.querySelectorAll(".games-card-badge") || [])].map((b) => {
    const r = b.getBoundingClientRect();
    const cs = getComputedStyle(b);
    return { text: b.textContent.trim(), parent: b.parentElement?.className, pos: cs.position, top: cs.top, left: cs.left, rTop: Math.round(r.top), rLeft: Math.round(r.left) };
  });
  const after = media ? getComputedStyle(media, "::after") : null;
  const mediaCs = media ? getComputedStyle(media) : null;
  const bodyCs = body ? getComputedStyle(body) : null;
  const bodyR = body?.getBoundingClientRect();
  const mediaR = media?.getBoundingClientRect();
  const cardR = card?.getBoundingClientRect();
  return {
    badges,
    mediaAfterBg: after?.backgroundImage || after?.backgroundColor,
    mediaAfterDisplay: after?.display,
    mediaAfterH: after?.height,
    bodyPad: bodyCs?.padding,
    bodyBg: bodyCs?.backgroundImage,
    card: cardR && { t: Math.round(cardR.top), b: Math.round(cardR.bottom), h: Math.round(cardR.height) },
    media: mediaR && { t: Math.round(mediaR.top), b: Math.round(mediaR.bottom), h: Math.round(mediaR.height) },
    body: bodyR && { t: Math.round(bodyR.top), b: Math.round(bodyR.bottom), h: Math.round(bodyR.height) },
    html: card?.innerHTML?.slice(0, 800),
  };
});
await page.goto("http://127.0.0.1:4173/play/aboutUs", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const play = await page.evaluate(() => {
  const fav = document.querySelector(".play-page__fav-btn");
  const prev = document.querySelector(".play-page__prev-btn");
  const back = document.querySelector(".play-page__nav-btn, .btn.btn--ghost, .home-btn, a.back, button.back");
  const actions = document.querySelector(".play-page__actions, .game-page__actions, .play-page__secondary");
  const dump = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName,
      cls: el.className,
      bg: cs.backgroundImage + " | " + cs.backgroundColor,
      radius: cs.borderRadius,
      filter: cs.backdropFilter || cs.webkitBackdropFilter,
      w: Math.round(r.width),
      h: Math.round(r.height),
      parentCls: el.parentElement?.className,
      parentBg: el.parentElement ? getComputedStyle(el.parentElement).backgroundColor + " / " + getComputedStyle(el.parentElement).backgroundImage : null,
      parentRadius: el.parentElement ? getComputedStyle(el.parentElement).borderRadius : null,
      parentFilter: el.parentElement ? (getComputedStyle(el.parentElement).backdropFilter || getComputedStyle(el.parentElement).webkitBackdropFilter) : null,
    };
  };
  // walk up for dark plates
  const chain = [];
  let n = fav;
  for (let i = 0; i < 5 && n; i++) {
    const cs = getComputedStyle(n);
    chain.push({ cls: n.className?.toString?.().slice(0,80), bg: cs.backgroundColor, img: cs.backgroundImage?.slice(0,80), radius: cs.borderRadius, filter: cs.backdropFilter || cs.webkitBackdropFilter, overflow: cs.overflow });
    n = n.parentElement;
  }
  return { fav: dump(fav), prev: dump(prev), back: dump(back), actions: dump(actions), chain };
});
console.log(JSON.stringify({ comics, play }, null, 2));
await browser.close();
