const fs = require('fs')

const css = `/* Stage 2 home layout — works for WEB + Mini App; themes via html[data-theme]. */

.home-web-landing {
  --gnh-pink: #ff4fd8;
  --gnh-violet: #8b5cff;
  --gnh-blue: #4cc9ff;
  --gnh-radius: 1.15rem;
  --gnh-radius-lg: 1.45rem;
  --gnh-font-display: "Montserrat", "Unbounded", system-ui, sans-serif;
  --gnh-font-ui: "Inter", "Manrope", system-ui, sans-serif;
  --gnh-card: rgba(16, 18, 40, 0.72);
  --gnh-card-border: rgba(180, 160, 255, 0.22);
  --gnh-text: #f5f3ff;
  --gnh-muted: rgba(236, 233, 255, 0.78);
  --gnh-accent: linear-gradient(110deg, #ff4fd8 0%, #8b5cff 55%, #4cc9ff 120%);

  position: relative;
  width: 100%;
  max-width: min(72rem, 100%);
  margin-inline: auto;
  padding: 0.2rem max(0.15rem, env(safe-area-inset-right, 0px)) 1.6rem max(0.15rem, env(safe-area-inset-left, 0px));
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  font-family: var(--gnh-font-ui);
  color: var(--gnh-text);
  isolation: isolate;
  box-sizing: border-box;
}

html[data-theme="neon-light"] .home-web-landing {
  --gnh-card: rgba(255, 255, 255, 0.88);
  --gnh-card-border: rgba(142, 99, 255, 0.18);
  --gnh-text: #181426;
  --gnh-muted: rgba(24, 20, 38, 0.7);
  --gnh-accent: linear-gradient(110deg, #ff65d8 0%, #8e63ff 52%, #55b7ff 100%);
}

html[data-theme="sunset"] .home-web-landing {
  --gnh-card: rgba(255, 252, 250, 0.9);
  --gnh-card-border: rgba(255, 122, 107, 0.2);
  --gnh-text: #1f1410;
  --gnh-muted: rgba(31, 20, 16, 0.68);
  --gnh-pink: #ff6a88;
  --gnh-violet: #ff8e7a;
  --gnh-blue: #ffb341;
  --gnh-accent: linear-gradient(135deg, #ff9a8b 0%, #ff6a88 55%, #ff99ac 100%);
}

html[data-theme="minimal-calm"] .home-web-landing {
  --gnh-card: rgba(255, 255, 255, 0.92);
  --gnh-card-border: rgba(139, 168, 150, 0.2);
  --gnh-text: #232931;
  --gnh-muted: rgba(35, 41, 49, 0.68);
  --gnh-pink: #7b89b8;
  --gnh-violet: #5f7f74;
  --gnh-blue: #8ba896;
  --gnh-accent: linear-gradient(135deg, #5f7f74 0%, #8ba896 48%, #a8b5c4 100%);
}

.home-web-landing__themes {
  width: 100%;
  min-width: 0;
}

.home-web-landing__themes .theme-toggle-wrap {
  width: 100%;
}

.home-web-landing__footnote {
  margin: 0.25rem 0 0;
  text-align: center;
  font-size: 0.82rem;
  color: var(--gnh-muted);
  opacity: 0.7;
}

/* Nav */
.home-web-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin: 0;
  padding: 0.5rem 0.65rem 0.5rem 0.95rem;
  border-radius: 999px;
  background: var(--gnh-card);
  border: 1px solid var(--gnh-card-border);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
}

.home-web-nav__brand {
  font-family: var(--gnh-font-display);
  font-weight: 700;
  font-size: 0.98rem;
  letter-spacing: -0.02em;
  text-decoration: none;
  color: var(--gnh-text);
  white-space: nowrap;
}

.home-web-nav__links {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.home-web-nav__link {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--gnh-muted);
  font-family: inherit;
  font-size: 0.86rem;
  font-weight: 600;
  padding: 0.48rem 0.8rem;
  border-radius: 999px;
  text-decoration: none;
  cursor: pointer;
}

.home-web-nav__link.is-active,
.home-web-nav__link--cta {
  color: #fff;
  background: var(--gnh-accent);
  box-shadow: 0 6px 18px rgba(139, 92, 255, 0.28);
}

html[data-theme="neon-light"] .home-web-nav__link--cta,
html[data-theme="sunset"] .home-web-nav__link--cta,
html[data-theme="minimal-calm"] .home-web-nav__link--cta,
html[data-theme="neon-light"] .home-web-nav__link.is-active,
html[data-theme="sunset"] .home-web-nav__link.is-active,
html[data-theme="minimal-calm"] .home-web-nav__link.is-active {
  color: #fff;
}

/* Hero carousel */
.home-web-hero {
  position: relative;
  border-radius: var(--gnh-radius-lg);
  overflow: hidden;
  min-height: clamp(15.5rem, 42vw, 22rem);
  border: 1px solid var(--gnh-card-border);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.22);
  background: #0a0c18;
  touch-action: pan-y;
}

.home-web-hero__track {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: inherit;
  transition: transform 520ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
}

.home-web-hero__slide {
  position: relative;
  flex: 0 0 100%;
  min-width: 100%;
  min-height: inherit;
  display: grid;
  align-items: stretch;
}

.home-web-hero__bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 30%;
  pointer-events: none;
  user-select: none;
}

.home-web-hero__veil {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(6, 8, 22, 0.86) 0%, rgba(6, 8, 22, 0.5) 42%, rgba(6, 8, 22, 0.15) 70%, transparent 100%),
    linear-gradient(180deg, transparent 50%, rgba(6, 8, 22, 0.45) 100%);
  pointer-events: none;
}

.home-web-hero__copy {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: flex-start;
  gap: 0.55rem;
  padding: clamp(1rem, 3vw, 1.85rem);
  padding-bottom: 2.6rem;
  max-width: min(36rem, 92%);
}

.home-web-hero__badge {
  display: inline-flex;
  padding: 0.28rem 0.7rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #fff;
  background: var(--gnh-accent);
  box-shadow: 0 0 16px rgba(255, 79, 216, 0.28);
}

.home-web-hero__title {
  margin: 0;
  font-family: var(--gnh-font-display);
  font-size: clamp(1.7rem, 1.1rem + 2.2vw, 2.85rem);
  font-weight: 700;
  line-height: 1.05;
  color: #fff;
  text-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
}

.home-web-hero__desc {
  margin: 0;
  max-width: 36ch;
  color: rgba(236, 233, 255, 0.88);
  font-size: clamp(0.9rem, 0.82rem + 0.3vw, 1.05rem);
  line-height: 1.4;
}

.home-web-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-top: 0.25rem;
}

.home-web-hero__cta,
.home-web-hero__ghost {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.7rem;
  padding: 0 1.15rem;
  border-radius: 999px;
  text-decoration: none;
  font-weight: 700;
  font-size: 0.95rem;
}

.home-web-hero__cta {
  color: #fff;
  background: var(--gnh-accent);
  box-shadow: 0 10px 26px rgba(139, 92, 255, 0.38);
}

.home-web-hero__cta-icon {
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 6px 0 6px 10px;
  border-color: transparent transparent transparent #fff;
}

.home-web-hero__ghost {
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(8px);
  font-weight: 600;
}

.home-web-hero__arrow {
  position: absolute;
  top: 50%;
  z-index: 3;
  transform: translateY(-50%);
  width: 2.35rem;
  height: 2.35rem;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(10, 12, 28, 0.48);
  color: #fff;
  font-size: 1.35rem;
  line-height: 1;
  cursor: pointer;
  backdrop-filter: blur(10px);
}

.home-web-hero__arrow--prev { left: 0.65rem; }
.home-web-hero__arrow--next { right: 0.65rem; }

.home-web-hero__dots {
  position: absolute;
  left: 50%;
  bottom: 0.75rem;
  transform: translateX(-50%);
  z-index: 3;
  display: flex;
  gap: 0.35rem;
}

.home-web-hero__dot {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 999px;
  border: 0;
  padding: 0;
  background: rgba(255, 255, 255, 0.35);
  cursor: pointer;
  transition: width 200ms ease, background 200ms ease;
}

.home-web-hero__dot.is-active {
  width: 1.1rem;
  background: linear-gradient(90deg, var(--gnh-pink), var(--gnh-violet));
}

/* Quicks — 4 in a row like reference */
.home-web-quicks {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.55rem;
}

.home-web-quick {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 0.55rem;
  min-height: 5.4rem;
  padding: 0.75rem 0.7rem;
  border-radius: var(--gnh-radius);
  border: 1px solid var(--gnh-card-border);
  background: var(--gnh-card);
  color: var(--gnh-text);
  text-decoration: none;
  cursor: pointer;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.12);
  transition: transform 160ms ease, box-shadow 200ms ease;
  font: inherit;
  text-align: left;
}

.home-web-quick:hover,
.home-web-quick:focus-visible {
  transform: translateY(-2px);
  outline: none;
}

.home-web-quick__icon {
  width: 2.15rem;
  height: 2.15rem;
  border-radius: 0.75rem;
  display: grid;
  place-items: center;
  font-size: 1.05rem;
  background: rgba(139, 92, 255, 0.18);
}

.home-web-quick--fav .home-web-quick__icon { background: rgba(255, 79, 216, 0.18); color: #ff8ae8; }
.home-web-quick--new .home-web-quick__icon { background: rgba(76, 201, 255, 0.16); color: #7ddfff; }
.home-web-quick--hot .home-web-quick__icon { background: rgba(250, 204, 21, 0.14); color: #fde68a; }
.home-web-quick--cat .home-web-quick__icon { background: rgba(139, 92, 255, 0.2); color: #c4b5fd; }

html[data-theme="neon-light"] .home-web-quick--fav .home-web-quick__icon,
html[data-theme="sunset"] .home-web-quick--fav .home-web-quick__icon,
html[data-theme="minimal-calm"] .home-web-quick--fav .home-web-quick__icon {
  color: var(--gnh-pink);
}
html[data-theme="neon-light"] .home-web-quick--hot .home-web-quick__icon { color: #c9a227; }
html[data-theme="sunset"] .home-web-quick--hot .home-web-quick__icon { color: #d97706; }
html[data-theme="minimal-calm"] .home-web-quick--hot .home-web-quick__icon { color: #8a7a3a; }

.home-web-quick__label {
  font-size: 0.82rem;
  font-weight: 700;
  line-height: 1.2;
}

/* Premium strip */
.home-web-premium-strip {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.75rem 0.95rem;
  border-radius: var(--gnh-radius);
  border: 1px solid var(--gnh-card-border);
  background: var(--gnh-card);
  color: var(--gnh-text);
  cursor: pointer;
  text-align: left;
  font: inherit;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.1);
}

.home-web-premium-strip__gem {
  font-size: 1.35rem;
  color: var(--gnh-violet);
}

.home-web-premium-strip__text {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  flex: 1;
  min-width: 0;
}

.home-web-premium-strip__text strong {
  font-size: 0.95rem;
}

.home-web-premium-strip__text span {
  font-size: 0.78rem;
  color: var(--gnh-muted);
}

.home-web-premium-strip__price {
  font-weight: 700;
  font-size: 0.88rem;
  white-space: nowrap;
}

/* Sections */
.home-web-section {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  min-width: 0;
}

.home-web-section__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  padding-inline: 0.1rem;
}

.home-web-section__head h2 {
  margin: 0;
  font-family: var(--gnh-font-display);
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--gnh-text);
}

.home-web-section__more {
  color: var(--gnh-blue);
  font-size: 0.86rem;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}

html[data-theme="neon-dark"] .home-web-section__more {
  color: #7ddfff;
}

/* Popular — horizontal portrait cards */
.home-web-popular-row,
.home-web-new-row {
  list-style: none;
  margin: 0;
  padding: 0.15rem 0.1rem 0.45rem;
  display: flex;
  gap: 0.7rem;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.home-web-popular-row::-webkit-scrollbar,
.home-web-new-row::-webkit-scrollbar {
  display: none;
}

.home-web-popular-row > li,
.home-web-new-row > li {
  scroll-snap-align: start;
  flex: 0 0 auto;
}

.home-web-game-card {
  width: clamp(8.6rem, 28vw, 10.5rem);
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.home-web-game-card__media {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 3 / 4;
  border-radius: 1rem;
  overflow: hidden;
  border: 1px solid var(--gnh-card-border);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
  background: #0a0c18;
}

.home-web-game-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.home-web-game-card__body {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding-inline: 0.1rem;
  min-width: 0;
}

.home-web-game-card__title {
  font-size: 0.88rem;
  font-weight: 700;
  line-height: 1.25;
  color: var(--gnh-text);
}

.home-web-game-card__meta {
  font-size: 0.75rem;
  color: var(--gnh-muted);
}

.home-web-game-card__play {
  position: absolute;
  right: 0.45rem;
  bottom: 0.45rem;
  width: 1.85rem;
  height: 1.85rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.28);
}

.home-web-game-card__play::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 53%;
  transform: translate(-50%, -50%);
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 5px 0 5px 8px;
  border-color: transparent transparent transparent #7c3aed;
}

.home-web-game-card__media .home-web-game-card__play {
  /* ensure play sits on media — body is sibling; reposition via media only */
}

/* play button is sibling after media in markup — move onto media visually */
.home-web-game-card {
  position: relative;
}

.home-web-game-card > .home-web-game-card__play {
  top: auto;
  bottom: calc(0.45rem + 2.6rem);
}

@media (min-width: 480px) {
  .home-web-game-card > .home-web-game-card__play {
    bottom: calc(0.45rem + 2.75rem);
  }
}

/* Better: put play inside media via absolute on card relative to media height */
.home-web-game-card > .home-web-game-card__play {
  right: 0.45rem;
  /* media is aspect 3/4 of card width; body ~2.5rem below */
  top: calc(clamp(8.6rem, 28vw, 10.5rem) * 4 / 3 - 2.3rem);
  bottom: auto;
}

/* New games — landscape cards */
.home-web-new-card {
  width: clamp(14.5rem, 68vw, 18.5rem);
  position: relative;
  display: block;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.home-web-new-card__media {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 16 / 10;
  border-radius: 1.05rem;
  overflow: hidden;
  border: 1px solid var(--gnh-card-border);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
  background: #0a0c18;
}

.home-web-new-card__media::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 40%, rgba(6, 8, 22, 0.82) 100%);
  pointer-events: none;
}

.home-web-new-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.home-web-new-card__badge {
  position: absolute;
  top: 0.55rem;
  left: 0.55rem;
  z-index: 2;
  padding: 0.22rem 0.55rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #fff;
  background: var(--gnh-accent);
}

.home-web-new-card__title {
  position: absolute;
  left: 0.75rem;
  right: 0.75rem;
  bottom: 0.7rem;
  z-index: 2;
  margin: 0;
  color: #fff;
  font-size: 0.98rem;
  font-weight: 700;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
}

/* Responsive */
@media (max-width: 720px) {
  .home-web-nav {
    flex-direction: column;
    align-items: stretch;
    border-radius: 1.15rem;
    padding: 0.65rem 0.7rem;
  }

  .home-web-nav__links {
    justify-content: flex-start;
  }

  .home-web-nav__link {
    font-size: 0.8rem;
    padding: 0.42rem 0.65rem;
  }

  .home-web-hero__arrow {
    display: none;
  }

  .home-web-quicks {
    gap: 0.45rem;
  }

  .home-web-quick {
    min-height: 4.8rem;
    padding: 0.6rem 0.5rem;
  }

  .home-web-quick__label {
    font-size: 0.72rem;
  }

  .home-web-quick__icon {
    width: 1.85rem;
    height: 1.85rem;
    font-size: 0.95rem;
  }
}

@media (min-width: 900px) {
  .home-web-landing {
    gap: 1rem;
    padding-bottom: 2rem;
  }

  .home-web-hero {
    min-height: clamp(18rem, 26vw, 24rem);
  }

  .home-web-hero__copy {
    justify-content: center;
    padding-bottom: clamp(1.2rem, 2vw, 2rem);
  }

  .home-web-quicks {
    gap: 0.85rem;
  }

  .home-web-quick {
    min-height: 6.2rem;
    padding: 1rem 0.95rem;
  }

  .home-web-game-card {
    width: 11rem;
  }

  .home-web-new-card {
    width: 20rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-web-hero__track,
  .home-web-quick,
  .home-web-hero__dot {
    transition: none !important;
  }
}
`

fs.writeFileSync('src/pages/HomeWeb.css', css)
console.log('css bytes', css.length)

// Fix play button placement in markup - better put play inside media in TSX
let tsx = fs.readFileSync('src/pages/HomeWeb.tsx', 'utf8')
tsx = tsx.replace(
  `<span className="home-web-game-card__media">
                  <Thumb image={g.image} avif={'avif' in g ? g.avif : undefined} className="home-web-game-card__img" />
                </span>
                <span className="home-web-game-card__body">
                  <span className="home-web-game-card__title">{g.title}</span>
                  {g.playersLabel ? <span className="home-web-game-card__meta">{g.playersLabel}</span> : null}
                </span>
                <span className="home-web-game-card__play" aria-hidden />`,
  `<span className="home-web-game-card__media">
                  <Thumb image={g.image} avif={'avif' in g ? g.avif : undefined} className="home-web-game-card__img" />
                  <span className="home-web-game-card__play" aria-hidden />
                </span>
                <span className="home-web-game-card__body">
                  <span className="home-web-game-card__title">{g.title}</span>
                  {g.playersLabel ? <span className="home-web-game-card__meta">{g.playersLabel}</span> : null}
                </span>`
)
fs.writeFileSync('src/pages/HomeWeb.tsx', tsx)

// Clean hacky play position CSS
let css2 = fs.readFileSync('src/pages/HomeWeb.css', 'utf8')
css2 = css2.replace(/\/\\* play button is sibling[\\s\\S]*?bottom: auto;\\n\\}/, '')
css2 = css2.replace(/\\.home-web-game-card__media \\.home-web-game-card__play \\{[\\s\\S]*?\\}\\n\\n/, '')
css2 = css2.replace(/\\.home-web-game-card \\{\\n  position: relative;\\n\\}\\n\\n\\.home-web-game-card > \\.home-web-game-card__play[\\s\\S]*?bottom: auto;\\n\\}\\n\\n/, '')
fs.writeFileSync('src/pages/HomeWeb.css', css2)
console.log('fixed play in media')
