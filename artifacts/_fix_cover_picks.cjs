const fs = require('fs')
const p = 'src/styles/web-desktop.css'
let s = fs.readFileSync(p, 'utf8')

const marker = '/* ========== WEB = Mini App visual parity (design only) ========== */'
const idx = s.indexOf(marker)
if (idx < 0) {
  console.error('marker missing')
  process.exit(1)
}

const block = `/* ========== WEB = Mini App shell + cover picks ========== */
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

/* Keep quick actions stacked like Mini App */
.app.app--web .home-neon-quick,
.app.app--web .home-light-quick,
.app.app--web .home-sunset-quick,
.app.app--web .home-calm-quick {
  display: flex !important;
  flex-direction: column !important;
  grid-template-columns: none !important;
}

/* Popular / New: full-bleed cover buttons (WEB only) */
.app.app--web .home-web-picks__list,
.app.app--web .home-neon-picks__list,
.app.app--web .home-light-picks__list,
.app.app--web .home-sunset-picks__list,
.app.app--web .home-calm-picks__list {
  display: flex !important;
  flex-direction: column !important;
  gap: 0.7rem !important;
  grid-template-columns: none !important;
}

.app.app--web .home-web-picks__list > li,
.app.app--web .home-neon-picks__list > li,
.app.app--web .home-light-picks__list > li,
.app.app--web .home-sunset-picks__list > li,
.app.app--web .home-calm-picks__list > li {
  width: 100%;
}

html[data-theme] .app.app--web .home-web-picks__card,
html[data-theme] .app.app--web .home-neon-picks__row,
html[data-theme] .app.app--web .home-light-picks__row,
html[data-theme] .app.app--web .home-sunset-picks__row,
html[data-theme] .app.app--web .home-calm-picks__row {
  position: relative !important;
  display: block !important;
  width: 100% !important;
  aspect-ratio: 16 / 9 !important;
  min-height: 0 !important;
  height: auto !important;
  padding: 0 !important;
  overflow: hidden !important;
  border-radius: 1.15rem !important;
  flex-direction: unset !important;
  align-items: unset !important;
  gap: 0 !important;
  text-align: left !important;
  isolation: isolate;
}

.app.app--web .home-picks__thumb-wrap {
  position: absolute !important;
  inset: 0 !important;
  width: 100% !important;
  height: 100% !important;
  margin: 0 !important;
  border-radius: 0 !important;
  overflow: hidden !important;
  flex: none !important;
}

.app.app--web .home-picks__thumb-wrap picture,
.app.app--web .home-picks__thumb {
  position: absolute !important;
  inset: 0 !important;
  display: block !important;
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;
  max-height: none !important;
  object-fit: cover !important;
  object-position: center !important;
}

.app.app--web .home-web-picks__card::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: linear-gradient(
    180deg,
    rgba(8, 10, 24, 0.05) 35%,
    rgba(8, 10, 24, 0.55) 72%,
    rgba(8, 10, 24, 0.82) 100%
  );
}

.app.app--web .home-web-picks__name,
.app.app--web .home-neon-picks__name,
.app.app--web .home-light-picks__name,
.app.app--web .home-sunset-picks__name,
.app.app--web .home-calm-picks__name {
  position: absolute !important;
  left: 0.9rem !important;
  right: 3.2rem !important;
  bottom: 0.85rem !important;
  z-index: 2;
  margin: 0 !important;
  padding: 0 !important;
  color: #fff !important;
  font-size: 0.98rem !important;
  font-weight: 700 !important;
  line-height: 1.25 !important;
  text-shadow: 0 1px 10px rgba(0, 0, 0, 0.45);
}

.app.app--web .home-picks__play {
  position: absolute !important;
  right: 0.75rem !important;
  bottom: 0.7rem !important;
  z-index: 2;
  margin: 0 !important;
}

.app.app--web .home-play-btn--picks {
  width: 2.35rem !important;
  height: 2.35rem !important;
  border-radius: 999px !important;
  background: rgba(255, 255, 255, 0.94) !important;
  border: 0 !important;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.28) !important;
  display: grid !important;
  place-items: center !important;
}

.app.app--web .home-play-btn--picks .home-play-btn__triangle {
  border-left-color: #7c3aed !important;
}

.app.app--web .home-web-picks__card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 28px rgba(26, 16, 42, 0.16);
}

.app.app--web .home-web-picks__card:hover .home-play-btn--picks {
  transform: scale(1.05);
}

html[data-theme="neon-dark"] .app.app--web .home-web-picks__card {
  border: 1px solid rgba(180, 160, 255, 0.22) !important;
  background: #0a0c18 !important;
}

html[data-theme="neon-light"] .app.app--web .home-web-picks__card,
html[data-theme="sunset"] .app.app--web .home-web-picks__card,
html[data-theme="minimal-calm"] .app.app--web .home-web-picks__card {
  border: 1px solid rgba(26, 16, 42, 0.08) !important;
  background: #111827 !important;
  box-shadow: 0 8px 22px rgba(26, 16, 42, 0.1) !important;
}

@media (prefers-reduced-motion: reduce) {
  .app.app--web .home-web-picks__card,
  .app.app--web .home-play-btn--picks {
    transition: none !important;
    transform: none !important;
  }
}
`

s = s.slice(0, idx) + block
fs.writeFileSync(p, s)
console.log('cover picks css ok', fs.statSync(p).size)
