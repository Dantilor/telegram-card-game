/** WEB SEO page styles, inlined into prerendered HTML and rendered by SeoMarkup. Scoped to #root .gnh-seo. */
export const SEO_PAGE_CSS = `#root .gnh-seo{position:fixed;inset:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;z-index:2;background:radial-gradient(120% 80% at 85% 0%,#5b3f86 0%,rgba(91,63,134,0) 60%),linear-gradient(180deg,#2a1748 0%,#1b0f30 55%,#150b26 100%);color:#f5ecff;font:16px/1.55 Manrope,"Segoe UI",Arial,sans-serif;-webkit-font-smoothing:antialiased;text-align:left}
#root .gnh-seo *{box-sizing:border-box}
#root .gnh-seo :where(a){color:inherit}
#root .gnh-seo__header{display:flex;align-items:center;justify-content:space-between;gap:16px;max-width:1120px;margin:0 auto;padding:calc(16px + env(safe-area-inset-top,0px)) 20px 16px}
#root .gnh-seo__logo{font:700 20px/1.1 Unbounded,Manrope,"Segoe UI",Arial,sans-serif;text-decoration:none;color:#cc9ff7;white-space:nowrap}
#root .gnh-seo__logo span{color:#fbefd2}
#root .gnh-seo__nav{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end}
#root .gnh-seo__nav a{text-decoration:none;font-weight:600;font-size:14px;padding:8px 12px;border-radius:999px;color:#eadcff}
#root .gnh-seo__nav a:hover{background:rgba(255,255,255,.08)}
#root .gnh-seo__nav .gnh-seo__nav-cta{background:#fbefd2;color:#2a1748}
#root .gnh-seo__main{max-width:1120px;margin:0 auto;padding:8px 20px 40px}
#root .gnh-seo__crumbs ol{display:flex;flex-wrap:wrap;gap:6px;list-style:none;margin:8px 0 0;padding:0;font-size:13px;color:#cdb8ea}
#root .gnh-seo__crumbs li+li::before{content:"/";margin-right:6px;opacity:.6}
#root .gnh-seo__crumbs a{text-decoration:none}
#root .gnh-seo__hero{padding:28px 0 20px;max-width:760px}
#root .gnh-seo h1{margin:0;font:700 clamp(30px,5vw,52px)/1.12 Unbounded,Manrope,"Segoe UI",Arial,sans-serif;letter-spacing:-.5px;background:linear-gradient(100deg,#cc9ff7 10%,#e5bcfa 55%,#f9ebca);-webkit-background-clip:text;background-clip:text;color:transparent}
#root .gnh-seo__lead{margin:16px 0 0;font-size:clamp(16px,1.8vw,19px);color:#eadcff}
#root .gnh-seo__cta{display:inline-flex;align-items:center;justify-content:center;min-height:52px;margin-top:24px;padding:0 28px;border-radius:999px;background:linear-gradient(100deg,#cc9ff7,#f9ebca);color:#22123d;font-weight:700;text-decoration:none;box-shadow:0 10px 30px rgba(204,159,247,.3)}
#root .gnh-seo__cta:active{transform:scale(.98)}
#root .gnh-seo__section{margin-top:36px}
#root .gnh-seo h2{margin:0 0 16px;font:700 clamp(21px,2.6vw,28px)/1.2 Unbounded,Manrope,"Segoe UI",Arial,sans-serif;color:#fbefd2}
#root .gnh-seo__section>p,#root .gnh-seo__section li{color:#eadcff}
#root .gnh-seo__section ul,#root .gnh-seo__section ol{margin:0;padding-left:22px;display:grid;gap:10px;max-width:820px}
#root .gnh-seo__games{list-style:none;padding:0!important;max-width:none!important;display:grid!important;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px!important}
#root .gnh-seo__game{display:flex;flex-direction:column;border-radius:20px;overflow:hidden;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}
#root .gnh-seo__game-link{position:relative;display:block;aspect-ratio:3/2;background:#2a1748}
#root .gnh-seo__game-link img{display:block;width:100%;height:100%;object-fit:cover}
#root .gnh-seo__badge{position:absolute;left:10px;top:10px;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;background:rgba(21,11,38,.78);color:#fbefd2;backdrop-filter:blur(6px)}
#root .gnh-seo__badge--free{background:#c6f2d4;color:#123a22}
#root .gnh-seo__badge--free-decks,#root .gnh-seo__badge--host-premium{background:rgba(21,11,38,.82);color:#c6f2d4}
#root .gnh-seo__game--text .gnh-seo__badge{position:static;align-self:flex-start;margin:16px 16px 0}
#root .gnh-seo__game-body{padding:14px 16px 18px}
#root .gnh-seo h3{margin:0 0 6px;font-size:18px;line-height:1.25}
#root .gnh-seo h3 a{text-decoration:none;color:#fff}
#root .gnh-seo__game-body p{margin:6px 0 0;font-size:14.5px;color:#e2d3f7}
#root .gnh-seo .gnh-seo__game-meta{color:#cc9ff7;font-weight:600;font-size:13px}
#root .gnh-seo .gnh-seo__game-note{color:#fbefd2}
#root .gnh-seo__related ul{list-style:none;padding:0!important;display:flex!important;flex-wrap:wrap;gap:10px!important}
#root .gnh-seo__related a{display:inline-flex;padding:10px 16px;border-radius:999px;border:1px solid rgba(255,255,255,.22);text-decoration:none;font-weight:600}
#root .gnh-seo__related a:hover{background:rgba(255,255,255,.08)}
#root .gnh-seo__footer{max-width:1120px;margin:0 auto;padding:24px 20px calc(32px + env(safe-area-inset-bottom,0px));border-top:1px solid rgba(255,255,255,.12);font-size:13px;color:#cdb8ea}
#root .gnh-seo__footer p{margin:4px 0}
#root .gnh-seo__footer-name{font-weight:700;color:#fbefd2}
#root .gnh-seo__footer nav{display:flex;flex-wrap:wrap;gap:8px 16px;margin:12px 0}
#root .gnh-seo__footer a{color:#eadcff}
@media (max-width:640px){#root .gnh-seo__nav a:not(.gnh-seo__nav-cta){display:none}#root .gnh-seo__hero{padding-top:16px}#root .gnh-seo__cta{width:100%}}`
