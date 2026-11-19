import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const shots = [
  ["home", 1440, 900, "/"],
  ["home", 1920, 1080, "/"],
  ["home", 768, 900, "/"],
  ["home", 390, 844, "/"],
  ["games", 1440, 900, "/games"],
  ["games", 1920, 1080, "/games"],
  ["games", 768, 900, "/games"],
  ["games", 390, 844, "/games"],
];
const out = {};
for (const [name, w, h, path] of shots) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto("http://127.0.0.1:4173" + path, { waitUntil: "networkidle" });
  const key = name + w;
  out[key] = await page.evaluate(() => {
    const scroller = document.querySelector(".gnh-home-scroll") || document.querySelector(".gnh-inside");
    const popular = document.querySelector("#gnh-popular-title");
    const hero = document.querySelector(".hero");
    const cta = document.querySelector(".hero-play");
    const card = document.querySelector(".games-page .games-grid__card--image");
    const img = document.querySelector(".games-page .games-grid__card-image-wrap");
    const heroCard = document.querySelector(".games-page .hero-game-card");
    const cols = document.querySelector(".games-page .games-grid");
    const title = document.querySelector(".games-page .games-grid__title");
    const desc = document.querySelector(".games-page .games-grid__desc");
    const box = (el) => el ? Math.round(el.getBoundingClientRect().height) : null;
    const top = (el) => el ? Math.round(el.getBoundingClientRect().top) : null;
    return {
      overflow: scroller.scrollWidth - scroller.clientWidth,
      viewH: window.innerHeight,
      heroH: box(hero),
      ctaH: box(cta),
      popularTop: top(popular),
      popularVisible: popular ? popular.getBoundingClientRect().top < window.innerHeight : null,
      cardH: box(card),
      imgH: box(img),
      heroCardH: box(heroCard),
      cols: cols ? getComputedStyle(cols).gridTemplateColumns.split(" ").length : null,
      title: title ? getComputedStyle(title).fontSize : null,
      desc: desc ? getComputedStyle(desc).fontSize : null,
      imgFit: img ? getComputedStyle(img.querySelector("img")).objectFit : null,
    };
  });
  await page.screenshot({ path: `artifacts/web-ui-pass/t2-${name}-${w}.png` });
  await page.close();
}
console.log(JSON.stringify(out, null, 2));
await browser.close();
