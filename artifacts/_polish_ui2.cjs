const fs = require('fs')
let css = fs.readFileSync('src/pages/HomeWeb.css', 'utf8')

// Stronger hero copy spacing + room for dots
css = css.replace(
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
  gap: 0.45rem;
  padding: 0.85rem 0.85rem 2.15rem;
  max-width: 100%;
  box-sizing: border-box;
}`
)

css = css.replace(
  `.home-web-hero__title {
  margin: 0;
  font-family: var(--gnh-font-display);
  font-size: clamp(1.35rem, 1.05rem + 1.6vw, 2.35rem);
  font-weight: 700;
  line-height: 1.08;
  color: #fff;
  text-shadow: 0 8px 22px rgba(0, 0, 0, 0.5);
  max-width: 16ch;
}`,
  `.home-web-hero__title {
  margin: 0;
  font-family: var(--gnh-font-display);
  font-size: clamp(1.4rem, 1.1rem + 1.5vw, 2.35rem);
  font-weight: 700;
  line-height: 1.1;
  color: #fff;
  text-shadow: 0 8px 22px rgba(0, 0, 0, 0.5);
  max-width: min(100%, 12.5rem);
  overflow-wrap: anywhere;
}`
)

// Mobile hero copy padding
css = css.replace(
  `  .home-web-hero__copy {
    padding: 0.7rem 0.75rem 1.7rem;
    gap: 0.3rem;
  }`,
  `  .home-web-hero__copy {
    padding: 0.65rem 0.75rem 2rem;
    gap: 0.4rem;
  }`
)

// Welcome + section more truncation fixes for landing
if (!css.includes('home-web-landing .home-welcome')) {
  css += `

/* Welcome / links: keep inside phone column */
.home-web-landing .home-welcome-top,
.home-web-landing [class*="home-welcome"] {
  max-width: 100%;
  overflow: hidden;
}

.home-web-section__more {
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 42%;
}

.home-web-premium-strip {
  overflow: hidden;
}

.home-web-premium-strip__price {
  flex-shrink: 0;
  max-width: 35%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.home-web-quick__label {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
`
}

fs.writeFileSync('src/pages/HomeWeb.css', css)

// Theme background: show cubes more clearly on phone
fs.writeFileSync('src/components/ThemeBackground.css', `/* Theme atmosphere: cubes top / stones bottom */
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
  left: 0;
  right: 0;
  display: block;
  width: 100%;
  height: auto;
  margin: 0 auto;
  max-width: 100%;
  pointer-events: none;
  user-select: none;
}

.gnh-theme-background__art--top {
  top: 0;
  object-fit: cover;
  object-position: center top;
  min-height: 55vh;
  -webkit-mask-image: linear-gradient(to bottom, #000 0%, #000 48%, transparent 88%);
  mask-image: linear-gradient(to bottom, #000 0%, #000 48%, transparent 88%);
}

.gnh-theme-background__art--bottom {
  bottom: 0;
  object-fit: cover;
  object-position: center bottom;
  min-height: 42vh;
  -webkit-mask-image: linear-gradient(to top, #000 0%, #000 40%, transparent 82%);
  mask-image: linear-gradient(to top, #000 0%, #000 40%, transparent 82%);
}

@media (min-width: 768px) {
  .gnh-theme-background__art {
    left: 50%;
    right: auto;
    width: min(100%, 52rem);
    max-width: 52rem;
    transform: translateX(-50%);
  }

  .gnh-theme-background__art--top,
  .gnh-theme-background__art--bottom {
    min-height: 0;
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

// HomeWelcomeTop mobile under landing — widen players text a bit
let welcome = fs.readFileSync('src/components/HomeWelcomeTop.css', 'utf8')
if (!welcome.includes('home-web-landing')) {
  welcome += `

.home-web-landing .home-welcome-top__players,
.home-web-landing .home-welcome-players,
.home-web-landing [class*="players"] {
  max-width: min(48%, 9.5rem) !important;
  font-size: 0.7rem;
  line-height: 1.2;
}
`
  fs.writeFileSync('src/components/HomeWelcomeTop.css', welcome)
  console.log('welcome override')
}

console.log('polish done')
