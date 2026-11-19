const fs = require('fs')
const p = 'src/styles/web-desktop.css'
let s = fs.readFileSync(p, 'utf8')

// Fix broken nested picks block inside desktop media query
const brokenStart = '  /* Picks → card grid (override TG 869/100 strip rows) */'
const brokenEndMarker = '  .app.app--web .home-web-picks__head {'
const i0 = s.indexOf(brokenStart)
const i1 = s.indexOf(brokenEndMarker, i0)
if (i0 < 0 || i1 < 0) {
  console.error('broken block markers missing', i0, i1)
  process.exit(1)
}

const replacement = `  /* Picks cover layout is defined in the WEB cover-picks block below (file end). */
  .app.app--web .home-web-picks__head {
`

s = s.slice(0, i0) + replacement + s.slice(i1 + brokenEndMarker.length)

// Also neutralize mobile grid that fights covers
s = s.replace(
  `@media (max-width: 767px) {
  .app.app--web .profile-shell,
  .app.app--web .favorites-page {
    gap: 0.75rem;
  }

  .app.app--web .profile-pass,
  .app.app--web .profile-identity,
  .app.app--web .profile-menu {
    min-height: 0;
  }

  .app.app--web .home-neon-picks__list,
  .app.app--web .home-light-picks__list,
  .app.app--web .home-sunset-picks__list,
  .app.app--web .home-calm-picks__list,
  .app.app--web .home-web-picks__list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.65rem;
  }

  html[data-theme] .app.app--web .home-neon-picks__row,
  html[data-theme] .app.app--web .home-light-picks__row,
  html[data-theme] .app.app--web .home-sunset-picks__row,
  html[data-theme] .app.app--web .home-calm-picks__row {
    aspect-ratio: auto !important;
    flex-direction: column;
    min-height: 0;
    height: auto;
    padding: 0;
    overflow: hidden;
  }`,
  `@media (max-width: 767px) {
  .app.app--web .profile-shell,
  .app.app--web .favorites-page {
    gap: 0.75rem;
  }

  .app.app--web .profile-pass,
  .app.app--web .profile-identity,
  .app.app--web .profile-menu {
    min-height: 0;
  }`
)

// Replace cover picks block with stronger rules + min-height
const marker = '/* ========== WEB = Mini App shell + cover picks ========== */'
const idx = s.indexOf(marker)
if (idx < 0) {
  console.error('cover marker missing')
  process.exit(1)
}

s = s.slice(0, idx) + `/* ========== WEB = Mini App shell + cover picks ========== */
.app.app--web .home-page--neon,
.app.app--web .home-page--light,
.app.app--web .home-page--sunset,
.app.app--web .home-page--calm,
.app.app--web .games-page,
.app.app--web .profile-page,
.app.app--web .play-page,
.app.app--web .favorites-page {
  max-width: 29.375rem !important;
  margin-inline: auto;
}

.app.app--web .home-web-nav {
  display: none !important;
}

.app.app--web .home-neon-quick,
.app.app--web .home-light-quick,
.app.app--web .home-sunset-quick,
.app.app--web .home-calm-quick {
  display: flex !important;
  flex-direction: column !important;
  grid-template-columns: none !important;
}

/* Popular / New: full-bleed cover cards (WEB only) */
.app.app--web .home-web-picks__list,
.app.app--web .home-neon-picks__list,
.app.app--web .home-light-picks__list,
.app.app--web .home-sunset-picks__list,
.app.app--web .home-calm-picks__list {
  display: flex !important;
  flex-direction: column !important;
  gap: 0.75rem !important;
  grid-template-columns: none !important;
}

.app.app--web .home-web-picks__list > li,
.app.app--web .home-neon-picks__list > li,
.app.app--web .home-light-picks__list > li,
.app.app--web .home-sunset-picks__list > li,
.app.app--web .home-calm-picks__list > li {
  width: 100%;
}

.app.app--web button.home-web-picks__card,
.app.app--web button.home-neon-picks__row,
.app.app--web button.home-light-picks__row,
.app.app--web button.home-sunset-picks__row,
.app.app--web button.home-calm-picks__row,
html[data-theme] .app.app--web .home-web-picks__card,
html[data-theme] .app.app--web .home-neon-picks__row,
html[data-theme] .app.app--web .home-light-picks__row,
html[data-theme] .app.app--web .home-sunset-picks__row,
html[data-theme] .app.app--web .home-calm-picks__row {
  position: relative !important;
  display: block !important;
  width: 100% !important;
  aspect-ratio: 16 / 10 !important;
  min-height: 9.75rem !important;
  height: auto !important;
  max-height: none !important;
  padding: 0 !important;
  overflow: hidden !important;
  border-radius: 1.15rem !important;
  flex-direction: row !important;
  align-items: stretch !important;
  gap: 0 !important;
  text-align: left !important;
  isolation: isolate;
  background: #111827 !important;
}

.app.app--web .home-web-picks .home-picks__thumb-wrap {
  position: absolute !important;
  inset: 0 !important;
  top: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 100% !important;
  min-height: 100% !important;
  margin: 0 !important;
  border-radius: 0 !important;
  overflow: hidden !important;
  flex: none !important;
  align-self: auto !important;
  aspect-ratio: auto !important;
  z-index: 0;
}

.app.app--web .home-web-picks .home-picks__thumb-wrap picture,
.app.app--web .home-web-picks .home-picks__thumb {
  position: absolute !important;
  inset: 0 !important;
  display: block !important;
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;
  max-height: none !important;
  object-fit: cover !important;
  object-position: center center !important;
}

.app.app--web .home-web-picks__card::after {
  content: "" !important;
  position: absolute !important;
  inset: 0 !important;
  z-index: 1;
  pointer-events: none;
  background: linear-gradient(
    180deg,
    rgba(8, 10, 24, 0.08) 28%,
    rgba(8, 10, 24, 0.52) 68%,
    rgba(8, 10, 24, 0.84) 100%
  );
}

.app.app--web .home-web-picks .home-web-picks__name,
.app.app--web .home-web-picks .home-neon-picks__name,
.app.app--web .home-web-picks .home-light-picks__name,
.app.app--web .home-web-picks .home-sunset-picks__name,
.app.app--web .home-web-picks .home-calm-picks__name {
  position: absolute !important;
  left: 0.95rem !important;
  right: 3.4rem !important;
  bottom: 0.9rem !important;
  z-index: 2;
  margin: 0 !important;
  padding: 0 !important;
  flex: none !important;
  color: #fff !important;
  font-size: 1rem !important;
  font-weight: 700 !important;
  line-height: 1.25 !important;
  text-shadow: 0 1px 12px rgba(0, 0, 0, 0.5);
}

.app.app--web .home-web-picks .home-picks__play {
  position: absolute !important;
  right: 0.8rem !important;
  bottom: 0.75rem !important;
  z-index: 2;
  margin: 0 !important;
  align-self: auto !important;
}

.app.app--web .home-web-picks .home-play-btn--picks {
  width: 2.45rem !important;
  height: 2.45rem !important;
  border-radius: 999px !important;
  border: 0 !important;
  background: rgba(255, 255, 255, 0.96) !important;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.28) !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.app.app--web .home-web-picks .home-play-btn--picks .home-play-btn__triangle {
  border-left-color: #7c3aed !important;
}

.app.app--web .home-web-picks__card:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 30px rgba(26, 16, 42, 0.18);
}

.app.app--web .home-web-picks__card:hover .home-play-btn--picks {
  transform: scale(1.04);
}

html[data-theme="neon-dark"] .app.app--web .home-web-picks__card {
  border: 1px solid rgba(180, 160, 255, 0.22) !important;
}

html[data-theme="neon-light"] .app.app--web .home-web-picks__card,
html[data-theme="sunset"] .app.app--web .home-web-picks__card,
html[data-theme="minimal-calm"] .app.app--web .home-web-picks__card {
  border: 1px solid rgba(26, 16, 42, 0.08) !important;
  box-shadow: 0 10px 24px rgba(26, 16, 42, 0.12) !important;
}

@media (prefers-reduced-motion: reduce) {
  .app.app--web .home-web-picks__card,
  .app.app--web .home-web-picks .home-play-btn--picks {
    transition: none !important;
    transform: none !important;
  }
}
`

fs.writeFileSync(p, s)
console.log('fixed css', fs.statSync(p).size)

// Mirror override at end of Home.css so it wins cascade after TG strip rules
const homeCss = 'src/pages/Home.css'
let h = fs.readFileSync(homeCss, 'utf8')
const homeMarker = '\\n/* === WEB picks cover (loaded after TG strip rules) === */\\n'
const cleaned = h.split('/* === WEB picks cover (loaded after TG strip rules) === */')[0].replace(/\\s+$/, '')
const homeAppend = `

/* === WEB picks cover (loaded after TG strip rules) === */
.app.app--web .home-web-picks__list {
  display: flex !important;
  flex-direction: column !important;
  gap: 0.75rem !important;
}

.app.app--web .home-web-picks button.home-web-picks__card {
  position: relative !important;
  display: block !important;
  width: 100% !important;
  aspect-ratio: 16 / 10 !important;
  min-height: 9.75rem !important;
  height: auto !important;
  padding: 0 !important;
  overflow: hidden !important;
  border-radius: 1.15rem !important;
  background: #111827 !important;
}

.app.app--web .home-web-picks .home-picks__thumb-wrap {
  position: absolute !important;
  inset: 0 !important;
  width: 100% !important;
  height: 100% !important;
  margin: 0 !important;
  border-radius: 0 !important;
  aspect-ratio: auto !important;
}

.app.app--web .home-web-picks .home-picks__thumb-wrap picture,
.app.app--web .home-web-picks .home-picks__thumb {
  position: absolute !important;
  inset: 0 !important;
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
}

.app.app--web .home-web-picks .home-web-picks__name,
.app.app--web .home-web-picks .home-neon-picks__name,
.app.app--web .home-web-picks .home-light-picks__name,
.app.app--web .home-web-picks .home-sunset-picks__name,
.app.app--web .home-web-picks .home-calm-picks__name {
  position: absolute !important;
  left: 0.95rem !important;
  right: 3.4rem !important;
  bottom: 0.9rem !important;
  z-index: 2;
  color: #fff !important;
  margin: 0 !important;
}

.app.app--web .home-web-picks .home-picks__play {
  position: absolute !important;
  right: 0.8rem !important;
  bottom: 0.75rem !important;
  z-index: 2;
}

.app.app--web .home-web-picks .home-play-btn--picks {
  width: 2.45rem !important;
  height: 2.45rem !important;
  border: 0 !important;
  background: rgba(255, 255, 255, 0.96) !important;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.28) !important;
}
`
fs.writeFileSync(homeCss, cleaned + homeAppend)
console.log('home css appended', fs.statSync(homeCss).size)
