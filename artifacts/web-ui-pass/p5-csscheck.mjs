import { chromium } from "playwright";
const b = await chromium.launch({ channel: "msedge", headless: true });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:4173/alias", { waitUntil: "networkidle" });
const info = await page.evaluate(() => {
  const section = document.querySelector(".alias-home__section");
  const sheets = [...document.querySelectorAll('link[rel="stylesheet"]')].map(l => l.href.split("/").pop());
  return {
    shell: document.documentElement.getAttribute("data-gnh-shell"),
    hasAppWeb: !!document.querySelector(".app.app--web"),
    hasInside: !!document.querySelector(".gnh-inside"),
    sectionClass: section?.className,
    margin: section ? getComputedStyle(section).marginBottom : null,
    sheets,
    htmlClass: document.documentElement.outerHTML.includes("margin-bottom:32px"),
  };
});
console.log(JSON.stringify(info, null, 2));
// Check if rule exists in any stylesheet
const rule = await page.evaluate(() => {
  const needles = ["margin-bottom: 32px", "margin-bottom:32px"];
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    for (const r of rules) {
      const text = r.cssText || "";
      if (needles.some(n => text.includes(n)) && text.includes("alias-home__section")) {
        return { href: sheet.href?.split("/").pop(), text: text.slice(0, 200) };
      }
    }
  }
  return null;
});
console.log("RULE", rule);
await b.close();
