const fs = require('fs')

fs.writeFileSync('src/components/ThemeBackground.css', `/* Full-viewport theme atmosphere — fills side gutters on desktop */
.gnh-theme-background {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  user-select: none;
  background-color: var(--gnh-theme-background-base, #060a1b);
}

.gnh-theme-background--neon { --gnh-theme-background-base: #060a1b; }
.gnh-theme-background--light { --gnh-theme-background-base: #f6f4ff; }
.gnh-theme-background--sunset { --gnh-theme-background-base: #fff5f0; }
.gnh-theme-background--calm { --gnh-theme-background-base: #f5f7f6; }

.gnh-theme-background__art {
  position: absolute;
  left: 0;
  width: 100%;
  height: auto;
  min-height: 70vh;
  object-fit: cover;
  pointer-events: none;
  user-select: none;
}

.gnh-theme-background__art--top {
  top: 0;
  object-position: center top;
  -webkit-mask-image: linear-gradient(to bottom, #000 0%, #000 55%, transparent 100%);
  mask-image: linear-gradient(to bottom, #000 0%, #000 55%, transparent 100%);
}

.gnh-theme-background__art--bottom {
  bottom: 0;
  min-height: 55vh;
  object-position: center bottom;
  -webkit-mask-image: linear-gradient(to top, #000 0%, #000 50%, transparent 100%);
  mask-image: linear-gradient(to top, #000 0%, #000 50%, transparent 100%);
}

.app > :not(.gnh-theme-background) {
  position: relative;
  z-index: 1;
}

html, body, #root {
  background-color: var(--app-page-bg-color, #060a1b);
}

.app,
.app.app--web {
  background-color: transparent !important;
  background-image: none !important;
}
`)

fs.writeFileSync('src/pages/HomeWeb.css', `/* Stage 2 — phone-column home matching reference mock */

.home-web-landing {
  --gnh-pink: #ff4fd8;
  --gnh-violet: #8b5cff;
  --gnh-blue: #4cc9ff;
  --gnh-card: rgba(12, 14, 32, 0.82);
  --gnh-card-border: rgba(180, 160, 255, 0.2);
  --gnh-text: #f5f3ff;
  --gnh-muted: rgba(210, 205, 240, 0.78);
  --gnh-accent: linear-gradient(110deg, #ff4fd8 0%, #8b5cff 55%, #4cc9ff 120%);
  --gnh-radius: 1.125rem;
  --gnh-radius-lg: 1.35rem;
  --gnh-gap: 0.7rem;
  --gnh-pad: 0.85rem;
  --gnh-font-display: "Montserrat", "Unbounded", system-ui, sans-serif;
  --gnh-font-ui: "Inter", "Manrope", system-ui, sans-serif;

  box-sizing: border-box;
  flex: 1 0 auto;
  width: 100%;
  max-width: 26.5rem; /* ~424px — phone column like reference */
  margin-inline: auto;
  padding: 0 0 1.5rem;
  display: flex;
  flex-direction: column;
  gap: var(--gnh-gap);
  font-family: var(--gnh-font-ui);
  color: var(--gnh-text);
  isolation: isolate;
}

html[data-theme="neon-light"] .home-web-landing {
  --gnh-card: rgba(255, 255, 255, 0.9);
  --gnh-card-border: rgba(142, 99, 255, 0.16);
  --gnh-text: #181426;
  --gnh-muted: rgba(24, 20, 38, 0.68);
  --gnh-accent: linear-gradient(110deg, #ff65d8 0%, #8e63ff 52%, #55b7ff 100%);
}

html[data-theme="sunset"] .home-web-landing {
  --gnh-card: rgba(255, 252, 250, 0.92);
  --gnh-card-border: rgba(255, 122, 107, 0.18);
  --gnh-text: #1f1410;
  --gnh-muted: rgba(31, 20, 16, 0.65);
  --gnh-pink: #ff6a88;
  --gnh-violet: #ff8e7a;
  --gnh-blue: #e8794a;
  --gnh-accent: linear-gradient(135deg, #ff9a8b 0%, #ff6a88 55%, #ff99ac 100%);
}

html[data-theme="minimal-calm"] .home-web-landing {
  --gnh-card: rgba(255, 255, 255, 0.94);
  --gnh-card-border: rgba(139, 168, 150, 0.18);
  --gnh-text: #232931;
  --gnh-muted: rgba(35, 41, 49, 0.65);
  --gnh-pink: #7b89b8;
  --gnh-violet: #5f7f74;
  --gnh-blue: #5f7f74;
  --gnh-accent: linear-gradient(135deg, #5f7f74 0%, #8ba896 48%, #a8b5c4 100%);
}

.home-web-landing__themes { width: 100%; min-width: 0; }
.home-web-landing__themes .theme-toggle-wrap { width: 100%; align-items: stretch; }
.home-web-landing__footnote {
  margin: 0.15rem 0 0;
  text-align: center;
  font-size: 0.75rem;
  color: var(--gnh-muted);
  opacity: 0.65;
}

/* ——— Welcome (scoped) ——— */
.home-web-landing .home-welcome-top { margin: 0; }
.home-web-landing .home-welcome-top__card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  padding: 0.75rem 0.85rem;
  border-radius: var(--gnh-radius-lg);
  background: var(--gnh-card);
  border: 1px solid var(--gnh-card-border);
  backdrop-filter: blur(16px);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.22);
}
.home-web-landing .home-welcome-top__stats-block {
  max-width: 42%;
  text-align: right;
  flex-shrink: 0;
}
.home-web-landing .home-welcome-top__stats-value {
  display: block;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--gnh-text);
  line-height: 1.15;
}
.home-web-landing .home-welcome-top__stats-caption {
  display: block;
  font-size: 0.68rem;
  color: var(--gnh-muted);
  line-height: 1.25;
}

/* ——— Nav ——— */
.home-web-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin: 0;
  padding: 0.4rem 0.45rem 0.4rem 0.85rem;
  border-radius: 999px;
  background: var(--gnh-card);
  border: 1px solid var(--gnh-card-border);
  backdrop-filter: blur(16px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
}
.home-web-nav__brand {
  font-family: var(--gnh-font-display);
  font-weight: 700;
  font-size: 0.92rem;
  letter-spacing: -0.02em;
  text-decoration: none;
  color: var(--gnh-text);
  white-space: nowrap;
  background: linear-gradient(100deg, #fff 10%, #c4b5fd 55%, #9ad8ff 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
html[data-theme="neon-light"] .home-web-nav__brand,
html[data-theme="sunset"] .home-web-nav__brand,
html[data-theme="minimal-calm"] .home-web-nav__brand {
  background: none;
  -webkit-background-clip: unset;
  background-clip: unset;
  color: var(--gnh-text);
}
.home-web-nav__links {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
}
.home-web-nav__links::-webkit-scrollbar { display: none; }
.home-web-nav__link {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--gnh-muted);
  font: inherit;
  font-size: 0.72rem;
  font-weight: 650;
  padding: 0.42rem 0.62rem;
  border-radius: 999px;
  text-decoration: none;
  cursor: pointer;
  white-space: nowrap;
}
.home-web-nav__link.is-active,
.home-web-nav__link--cta {
  color: #fff !important;
  background: var(--gnh-accent);
  box-shadow: 0 4px 14px rgba(139, 92, 255, 0.35);
}

/* ——— Theme toggle (high contrast) ——— */
.home-web-landing .theme-toggle {
  display: grid !important;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.3rem;
  width: 100%;
  max-width: 100%;
  min-height: 4.1rem;
  padding: 0.3rem;
  overflow: hidden;
  background: var(--gnh-card) !important;
  border: 1px solid var(--gnh-card-border) !important;
  border-radius: 1.15rem !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
}
.home-web-landing .theme-toggle__btn {
  display: flex !important;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  min-width: 0 !important;
  flex: 1 1 auto !important;
  padding: 0.45rem 0.1rem !important;
  font-size: 0.68rem !important;
  font-weight: 650 !important;
  color: var(--gnh-muted) !important;
  background: transparent !important;
  border: 0 !important;
  border-radius: 0.85rem !important;
  box-shadow: none !important;
  opacity: 1 !important;
}
.home-web-landing .theme-toggle__btn::before {
  content: "";
  display: block;
  width: 1.05rem;
  height: 1.05rem;
  background: center / contain no-repeat;
  opacity: 0.9;
}
.home-web-landing .theme-toggle__btn[data-theme-id="neon-dark"]::before {
  background-image: url('../assets/icons/gnh/theme-neon-gamepad.svg');
}
.home-web-landing .theme-toggle__btn[data-theme-id="neon-light"]::before {
  background-image: url('../assets/icons/gnh/theme-light-star.svg');
}
.home-web-landing .theme-toggle__btn[data-theme-id="sunset"]::before {
  background-image: url('../assets/icons/gnh/theme-sunset-sun.svg');
}
.home-web-landing .theme-toggle__btn[data-theme-id="minimal-calm"]::before {
  background-image: url('../assets/icons/gnh/theme-calm-leaf.svg');
}
.home-web-landing .theme-toggle__btn--active {
  color: #fff !important;
  background: var(--gnh-accent) !important;
  box-shadow: 0 0 18px rgba(255, 79, 216, 0.28) !important;
}
.home-web-landing .theme-toggle__btn--active::before { opacity: 1; filter: brightness(1.2); }

/* ——— Hero ——— */
.home-web-hero {
  position: relative;
  width: 100%;
  flex: 0 0 auto;
  aspect-ratio: 16 / 11;
  min-height: 13.75rem;
  border-radius: var(--gnh-radius-lg);
  overflow: hidden;
  border: 1px solid var(--gnh-card-border);
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.28);
  background: #070914;
  touch-action: pan-y;
}
.home-web-hero__track {
  position: absolute;
  inset: 0;
  display: flex;
  height: 100%;
  transition: transform 520ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
}
.home-web-hero__slide {
  position: relative;
  flex: 0 0 100%;
  width: 100%;
  min-width: 100%;
  height: 100%;
  overflow: hidden;
}
.home-web-hero__bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 28%;
  pointer-events: none;
}
.home-web-hero__veil {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(105deg, rgba(5, 7, 18, 0.88) 0%, rgba(5, 7, 18, 0.55) 40%, rgba(5, 7, 18, 0.12) 68%, transparent 85%),
    linear-gradient(180deg, transparent 42%, rgba(5, 7, 18, 0.72) 100%);
  pointer-events: none;
}
.home-web-hero__copy {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.4rem;
  padding: 0.85rem 0.9rem 1.95rem;
  box-sizing: border-box;
}
.home-web-hero__slide:not(.is-active) .home-web-hero__copy a { visibility: hidden; }
.home-web-hero__badge {
  display: inline-flex;
  padding: 0.22rem 0.6rem;
  border-radius: 999px;
  font-size: 0.62rem;
  font-weight: 750;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #fff;
  background: var(--gnh-accent);
}
.home-web-hero__title {
  margin: 0;
  font-family: var(--gnh-font-display);
  font-size: clamp(1.45rem, 1.15rem + 1.4vw, 2.1rem);
  font-weight: 750;
  line-height: 1.08;
  color: #fff;
  text-shadow: 0 6px 18px rgba(0, 0, 0, 0.5);
  max-width: 12rem;
}
.home-web-hero__desc {
  margin: 0;
  max-width: 22ch;
  color: rgba(236, 233, 255, 0.88);
  font-size: 0.8rem;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.home-web-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.15rem;
}
.home-web-hero__cta,
.home-web-hero__ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 2.25rem;
  padding: 0 0.95rem;
  border-radius: 999px;
  text-decoration: none;
  font-weight: 700;
  font-size: 0.82rem;
  white-space: nowrap;
}
.home-web-hero__cta {
  color: #fff;
  background: var(--gnh-accent);
  box-shadow: 0 8px 20px rgba(139, 92, 255, 0.4);
}
.home-web-hero__cta-icon {
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 5px 0 5px 8px;
  border-color: transparent transparent transparent #fff;
}
.home-web-hero__ghost {
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.32);
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(8px);
  font-weight: 650;
}
.home-web-hero__arrow {
  position: absolute;
  top: 50%;
  z-index: 3;
  transform: translateY(-50%);
  width: 2.15rem;
  height: 2.15rem;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(8, 10, 24, 0.55);
  color: #fff;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  backdrop-filter: blur(10px);
}
.home-web-hero__arrow--prev { left: 0.55rem; }
.home-web-hero__arrow--next { right: 0.55rem; }
.home-web-hero__dots {
  position: absolute;
  left: 50%;
  bottom: 0.5rem;
  transform: translateX(-50%);
  z-index: 4;
  display: flex;
  gap: 0.32rem;
}
.home-web-hero__dot {
  width: 0.38rem;
  height: 0.38rem;
  border-radius: 999px;
  border: 0;
  padding: 0;
  background: rgba(255, 255, 255, 0.35);
  cursor: pointer;
  transition: width 180ms ease, background 180ms ease;
}
.home-web-hero__dot.is-active {
  width: 1rem;
  background: linear-gradient(90deg, var(--gnh-pink), var(--gnh-violet));
}

/* ——— Quicks ——— */
.home-web-quicks {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
  width: 100%;
  flex: 0 0 auto;
}
.home-web-quick {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.55rem;
  min-width: 0;
  aspect-ratio: 1 / 1.05;
  padding: 0.7rem 0.55rem;
  border-radius: var(--gnh-radius);
  border: 1px solid var(--gnh-card-border);
  background: var(--gnh-card);
  color: var(--gnh-text);
  text-decoration: none;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.16);
  font: inherit;
  text-align: left;
  overflow: hidden;
}
.home-web-quick__icon {
  width: 1.85rem;
  height: 1.85rem;
  border-radius: 0.65rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.95rem;
  line-height: 1;
  background: rgba(139, 92, 255, 0.2);
}
.home-web-quick--fav .home-web-quick__icon { background: rgba(255, 79, 216, 0.2); color: #ff8ae8; }
.home-web-quick--new .home-web-quick__icon { background: rgba(76, 201, 255, 0.18); color: #7ddfff; }
.home-web-quick--hot .home-web-quick__icon { background: rgba(250, 204, 21, 0.16); color: #fde68a; }
.home-web-quick--cat .home-web-quick__icon { background: rgba(139, 92, 255, 0.22); color: #c4b5fd; }
.home-web-quick__label {
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1.15;
  max-width: 100%;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ——— Premium ——— */
.home-web-premium-strip {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  width: 100%;
  min-height: 3.55rem;
  padding: 0.75rem 0.9rem;
  border-radius: var(--gnh-radius);
  border: 1px solid var(--gnh-card-border);
  background: var(--gnh-card);
  color: var(--gnh-text);
  cursor: pointer;
  text-align: left;
  font: inherit;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.14);
  box-sizing: border-box;
}
.home-web-premium-strip__gem { font-size: 1.25rem; color: var(--gnh-violet); flex-shrink: 0; }
.home-web-premium-strip__text {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  flex: 1;
  min-width: 0;
}
.home-web-premium-strip__text strong { font-size: 0.9rem; }
.home-web-premium-strip__text span { font-size: 0.7rem; color: var(--gnh-muted); }
.home-web-premium-strip__price {
  font-weight: 700;
  font-size: 0.82rem;
  white-space: nowrap;
  flex-shrink: 0;
}

/* ——— Sections ——— */
.home-web-section {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  min-width: 0;
  flex: 0 0 auto;
}
.home-web-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding-inline: 0.05rem;
}
.home-web-section__head h2 {
  margin: 0;
  font-family: var(--gnh-font-display);
  font-size: 1.05rem;
  font-weight: 750;
  color: var(--gnh-text);
}
.home-web-section__more {
  color: var(--gnh-blue);
  font-size: 0.78rem;
  font-weight: 650;
  text-decoration: none;
  white-space: nowrap;
}
html[data-theme="neon-dark"] .home-web-section__more { color: #7ddfff; }

.home-web-popular-row,
.home-web-new-row {
  list-style: none;
  margin: 0;
  padding: 0.05rem 0 0.35rem;
  display: flex;
  gap: 0.65rem;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.home-web-popular-row::-webkit-scrollbar,
.home-web-new-row::-webkit-scrollbar { display: none; }
.home-web-popular-row > li,
.home-web-new-row > li {
  scroll-snap-align: start;
  flex: 0 0 auto;
}

.home-web-game-card {
  width: 8.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
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
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.2);
  background: #070914;
}
.home-web-game-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.home-web-game-card__play {
  position: absolute;
  right: 0.4rem;
  bottom: 0.4rem;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 5px 12px rgba(0, 0, 0, 0.3);
}
.home-web-game-card__play::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 54%;
  transform: translate(-50%, -50%);
  border-style: solid;
  border-width: 5px 0 5px 8px;
  border-color: transparent transparent transparent #7c3aed;
}
.home-web-game-card__body {
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
  padding-inline: 0.1rem;
  min-width: 0;
}
.home-web-game-card__title {
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1.25;
  color: var(--gnh-text);
}
.home-web-game-card__meta {
  font-size: 0.7rem;
  color: var(--gnh-muted);
}

.home-web-new-card {
  width: 14.25rem;
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
  border-radius: 1rem;
  overflow: hidden;
  border: 1px solid var(--gnh-card-border);
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.2);
  background: #070914;
}
.home-web-new-card__media::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 38%, rgba(5, 7, 18, 0.88) 100%);
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
  top: 0.5rem;
  left: 0.5rem;
  z-index: 2;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  font-size: 0.62rem;
  font-weight: 750;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #fff;
  background: var(--gnh-accent);
}
.home-web-new-card__title {
  position: absolute;
  left: 0.7rem;
  right: 0.7rem;
  bottom: 0.65rem;
  z-index: 2;
  margin: 0;
  color: #fff;
  font-size: 0.92rem;
  font-weight: 700;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
}

@media (min-width: 768px) {
  .home-web-landing {
    max-width: 27.5rem;
  }
  .home-web-hero {
    aspect-ratio: 16 / 10;
    min-height: 15rem;
  }
  .home-web-hero__arrow { display: flex; align-items: center; justify-content: center; }
}

@media (max-width: 420px) {
  .home-web-hero__arrow { display: none; }
  .home-web-nav__link { font-size: 0.68rem; padding: 0.38rem 0.5rem; }
  .home-web-quick__label { font-size: 0.65rem; }
}

@media (prefers-reduced-motion: reduce) {
  .home-web-hero__track,
  .home-web-hero__dot { transition: none !important; }
}
`)

// App: center phone column with visible side bg
let app = fs.readFileSync('src/App.css', 'utf8')
app = app.replace(
  /\.app:has\(\.home-web-landing\) \{[\s\S]*?\n\}\n\n@media \(min-width: 900px\) \{\n  \.app:has\(\.home-web-landing\) \{[\s\S]*?\n  \}\n\}/,
  `.app:has(.home-web-landing) {
  padding-left: max(0.75rem, var(--safe-left, 0px));
  padding-right: max(0.75rem, var(--safe-right, 0px));
  padding-bottom: max(0.85rem, var(--safe-bottom, 0px));
  background: transparent !important;
}

@media (min-width: 768px) {
  .app:has(.home-web-landing) {
    padding-left: max(1rem, var(--safe-left, 0px));
    padding-right: max(1rem, var(--safe-right, 0px));
  }
}`
)
fs.writeFileSync('src/App.css', app)

// web-desktop: don't fight landing width
let w = fs.readFileSync('src/styles/web-desktop.css', 'utf8')
w = w.replace(
  `.app.app--web .home-web-landing {
  max-width: min(72rem, 100%);
}`,
  `.app.app--web .home-web-landing {
  max-width: 27.5rem;
}`
)
fs.writeFileSync('src/styles/web-desktop.css', w)

console.log('reference CSS rewrite done')
