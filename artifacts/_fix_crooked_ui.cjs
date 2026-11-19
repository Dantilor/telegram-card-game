const fs = require('fs')

// --- ThemeBackground: better phone/desktop fill, stronger corner presence ---
fs.writeFileSync('src/components/ThemeBackground.css', `/* Theme atmosphere: cubes top / stones bottom, calm center */
.gnh-theme-background {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  user-select: none;
  background-color: var(--gnh-theme-background-base, var(--app-page-bg-color, #060a1b));
}

.gnh-theme-background--neon { --gnh-theme-background-base: #060a1b; }
.gnh-theme-background--light { --gnh-theme-background-base: #f6f4ff; }
.gnh-theme-background--sunset { --gnh-theme-background-base: #fff5f0; }
.gnh-theme-background--calm { --gnh-theme-background-base: #f5f7f6; }

.gnh-theme-background__art {
  position: absolute;
  left: 50%;
  display: block;
  width: 100%;
  max-width: 48rem;
  height: auto;
  transform: translateX(-50%);
  pointer-events: none;
  user-select: none;
  object-fit: cover;
  object-position: center top;
}

.gnh-theme-background__art--top {
  top: 0;
  -webkit-mask-image: linear-gradient(to bottom, #000 0%, #000 42%, transparent 78%);
  mask-image: linear-gradient(to bottom, #000 0%, #000 42%, transparent 78%);
}

.gnh-theme-background__art--bottom {
  bottom: 0;
  object-position: center bottom;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, transparent 45%, #000 78%, #000 100%);
  mask-image: linear-gradient(to bottom, transparent 0%, transparent 45%, #000 78%, #000 100%);
}

@media (min-width: 900px) {
  .gnh-theme-background__art {
    max-width: 64rem;
    width: min(100%, 64rem);
  }
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
  background-color: transparent;
  background-image: none;
}
`)

// --- Patch HomeWeb.css: hero fit, quicks, padding, cards ---
let css = fs.readFileSync('src/pages/HomeWeb.css', 'utf8')

css = css.replace(
  `  max-width: min(72rem, 100%);
  margin-inline: auto;
  padding: 0.2rem max(0.15rem, env(safe-area-inset-right, 0px)) 1.6rem max(0.15rem, env(safe-area-inset-left, 0px));
  display: flex;
  flex-direction: column;
  gap: 0.8rem;`,
  `  max-width: min(42rem, 100%);
  margin-inline: auto;
  padding: 0.15rem 0 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;`
)

// Hero: fixed aspect, contain copy, no overflow collision
css = css.replace(
  `/* Hero carousel */
.home-web-hero {
  position: relative;
  border-radius: var(--gnh-radius-lg);
  overflow: hidden;
  min-height: clamp(15.5rem, 42vw, 22rem);
  border: 1px solid var(--gnh-card-border);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.22);
  background: #0a0c18;
  touch-action: pan-y;
}`,
  `/* Hero carousel */
.home-web-hero {
  position: relative;
  border-radius: var(--gnh-radius-lg);
  overflow: hidden;
  aspect-ratio: 16 / 11;
  min-height: 0;
  height: auto;
  border: 1px solid var(--gnh-card-border);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.22);
  background: #0a0c18;
  touch-action: pan-y;
}`
)

css = css.replace(
  `.home-web-hero__track {
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
}`,
  `.home-web-hero__track {
  display: flex;
  width: 100%;
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
  display: block;
  overflow: hidden;
}`
)

css = css.replace(
  `.home-web-hero__copy {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: flex-start;
  gap: 0.55rem;
  padding: clamp(1rem, 3vw, 1.85rem);
  padding-bottom: 2.6rem;
  max-width: min(34rem, 88%);
  margin-right: auto;
}`,
  `.home-web-hero__copy {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: flex-start;
  gap: 0.35rem;
  padding: 0.85rem 0.9rem 1.85rem;
  max-width: 100%;
  box-sizing: border-box;
}`
)

css = css.replace(
  `.home-web-hero__title {
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
}`,
  `.home-web-hero__title {
  margin: 0;
  font-family: var(--gnh-font-display);
  font-size: clamp(1.35rem, 1.05rem + 1.6vw, 2.35rem);
  font-weight: 700;
  line-height: 1.08;
  color: #fff;
  text-shadow: 0 8px 22px rgba(0, 0, 0, 0.5);
  max-width: 16ch;
}

.home-web-hero__desc {
  margin: 0;
  max-width: 28ch;
  color: rgba(236, 233, 255, 0.88);
  font-size: clamp(0.78rem, 0.72rem + 0.25vw, 0.98rem);
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}`
)

css = css.replace(
  `.home-web-hero__cta,
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
}`,
  `.home-web-hero__cta,
.home-web-hero__ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 2.35rem;
  padding: 0 0.95rem;
  border-radius: 999px;
  text-decoration: none;
  font-weight: 700;
  font-size: 0.84rem;
  white-space: nowrap;
}`
)

css = css.replace(
  `.home-web-hero__dots {
  position: absolute;
  left: 50%;
  bottom: 0.75rem;
  transform: translateX(-50%);
  z-index: 3;
  display: flex;
  gap: 0.35rem;
}`,
  `.home-web-hero__dots {
  position: absolute;
  left: 50%;
  bottom: 0.55rem;
  transform: translateX(-50%);
  z-index: 4;
  display: flex;
  gap: 0.35rem;
  pointer-events: auto;
}`
)

// Quicks compact
css = css.replace(
  `.home-web-quicks {
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
}`,
  `.home-web-quicks {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.45rem;
}

.home-web-quick {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 0.45rem;
  min-height: 0;
  min-width: 0;
  padding: 0.65rem 0.5rem 0.7rem;
  border-radius: 1rem;
  border: 1px solid var(--gnh-card-border);
  background: var(--gnh-card);
  color: var(--gnh-text);
  text-decoration: none;
  cursor: pointer;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.12);
  transition: transform 160ms ease, box-shadow 200ms ease;
  font: inherit;
  text-align: left;
  overflow: hidden;
}`
)

css = css.replace(
  `.home-web-quick__label {
  font-size: 0.82rem;
  font-weight: 700;
  line-height: 1.2;
}`,
  `.home-web-quick__label {
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.2;
  max-width: 100%;
  overflow-wrap: anywhere;
  hyphens: auto;
}`
)

// Mobile media fixes
const mobileBlock = `@media (max-width: 720px) {
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
}`

const mobileNew = `@media (max-width: 720px) {
  .home-web-landing {
    max-width: 100%;
    gap: 0.65rem;
  }

  .home-web-nav {
    flex-direction: column;
    align-items: stretch;
    border-radius: 1.1rem;
    padding: 0.6rem 0.65rem;
  }

  .home-web-nav__links {
    justify-content: flex-start;
    gap: 0.2rem;
  }

  .home-web-nav__link {
    font-size: 0.78rem;
    padding: 0.4rem 0.6rem;
  }

  .home-web-hero {
    aspect-ratio: 4 / 3;
  }

  .home-web-hero__arrow {
    display: none;
  }

  .home-web-hero__copy {
    padding: 0.7rem 0.75rem 1.7rem;
    gap: 0.3rem;
  }

  .home-web-hero__badge {
    font-size: 0.62rem;
    padding: 0.2rem 0.55rem;
  }

  .home-web-hero__actions {
    gap: 0.4rem;
    width: 100%;
  }

  .home-web-hero__cta,
  .home-web-hero__ghost {
    min-height: 2.2rem;
    padding: 0 0.8rem;
    font-size: 0.8rem;
  }

  .home-web-quicks {
    gap: 0.4rem;
  }

  .home-web-quick {
    padding: 0.55rem 0.4rem 0.6rem;
    gap: 0.35rem;
    border-radius: 0.9rem;
  }

  .home-web-quick__icon {
    width: 1.7rem;
    height: 1.7rem;
    font-size: 0.9rem;
    border-radius: 0.55rem;
  }

  .home-web-quick__label {
    font-size: 0.68rem;
    line-height: 1.15;
  }

  .home-web-premium-strip {
    padding: 0.65rem 0.75rem;
    gap: 0.55rem;
  }

  .home-web-premium-strip__text span {
    font-size: 0.7rem;
  }

  .home-web-game-card {
    width: 8.25rem;
  }

  .home-web-game-card__title {
    font-size: 0.8rem;
  }

  .home-web-new-card {
    width: 13.5rem;
  }
}`

if (css.includes(mobileBlock)) {
  css = css.replace(mobileBlock, mobileNew)
  console.log('mobile block replaced')
} else {
  console.log('mobile block not exact, appending')
  css += '\\n' + mobileNew
}

// Desktop hero taller
css = css.replace(
  `@media (min-width: 900px) {
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
  }`,
  `@media (min-width: 900px) {
  .home-web-landing {
    max-width: min(52rem, 100%);
    gap: 1rem;
    padding-bottom: 2rem;
  }

  .home-web-hero {
    aspect-ratio: 16 / 9;
  }

  .home-web-hero__copy {
    max-width: 55%;
    padding: 1.35rem 1.5rem 2rem;
    gap: 0.5rem;
  }

  .home-web-hero__title {
    font-size: clamp(1.9rem, 1.4rem + 1.5vw, 2.6rem);
    max-width: 14ch;
  }

  .home-web-hero__desc {
    font-size: 1rem;
    -webkit-line-clamp: 3;
  }`
)

fs.writeFileSync('src/pages/HomeWeb.css', css)
console.log('HomeWeb.css patched', css.length)

// App padding for phone column feel
let app = fs.readFileSync('src/App.css', 'utf8')
app = app.replace(
  `.app:has(.home-web-landing) {
  padding-left: max(0.65rem, var(--safe-left, 0px));
  padding-right: max(0.65rem, var(--safe-right, 0px));
  padding-bottom: max(0.75rem, var(--safe-bottom, 0px));
}

@media (min-width: 900px) {
  .app:has(.home-web-landing) {
    padding-left: max(1.25rem, var(--safe-left, 0px));
    padding-right: max(1.25rem, var(--safe-right, 0px));
  }
}`,
  `.app:has(.home-web-landing) {
  padding-left: max(0.85rem, var(--safe-left, 0px));
  padding-right: max(0.85rem, var(--safe-right, 0px));
  padding-bottom: max(0.85rem, var(--safe-bottom, 0px));
}

@media (min-width: 900px) {
  .app:has(.home-web-landing) {
    padding-left: max(1.5rem, var(--safe-left, 0px));
    padding-right: max(1.5rem, var(--safe-right, 0px));
  }
}`
)
fs.writeFileSync('src/App.css', app)
console.log('app padding updated')
