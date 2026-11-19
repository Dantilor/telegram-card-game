const fs = require('fs')

// 1) Home.tsx — use Mini App themed home on WEB too
{
  let s = fs.readFileSync('src/pages/Home.tsx', 'utf8')
  s = s.replace("import HomeWeb from './HomeWeb'\n", '')
  s = s.replace(/\r?\n  if \(web\) \{\r?\n    return <HomeWeb \/>\r?\n  \}\r?\n/, '\n')
  // Hide WEB nav chrome to match Mini App chrome
  s = s.replace(/\{web \? <HomeWebNav onPremium=\{handlePremiumOpen\} \/> : null\}/g, '{null}')
  fs.writeFileSync('src/pages/Home.tsx', s)
  console.log('Home.tsx', !s.includes('return <HomeWeb'), !s.includes('<HomeWebNav'))
}

// 2) Play / Profile — drop WEB-only visual modifiers
{
  let s = fs.readFileSync('src/pages/Play.tsx', 'utf8')
  s = s.replace("import { isWebShell } from '../config/shell'\n", '')
  s = s.replace(
    '<div className={`play-page${isWebShell() ? \' play-page--web\' : \'\'}`}>',
    '<div className="play-page">'
  )
  fs.writeFileSync('src/pages/Play.tsx', s)
}
{
  let s = fs.readFileSync('src/pages/Profile.tsx', 'utf8')
  s = s.replace(
    '<div className={`profile-page${web ? \' profile-page--web\' : \'\'}`} aria-label="Профиль">',
    '<div className="profile-page" aria-label="Профиль">'
  )
  fs.writeFileSync('src/pages/Profile.tsx', s)
}

// 3) web-desktop.css — phone-column Mini App shell for WEB design parity
{
  let s = fs.readFileSync('src/styles/web-desktop.css', 'utf8')
  // Force phone shell at all breakpoints
  s = s.replace(/--web-shell-max: min\([^;]+;/g, '--web-shell-max: 29.375rem;')
  s = s.replace(
    '.app.app--web {\n  --web-shell-max: 29.375rem;',
    '.app.app--web {\n  /* WEB visual parity with Telegram Mini App (design only) */\n  --web-shell-max: 29.375rem;'
  )
  // Always hide home-web-nav
  if (!s.includes('WEB Mini App design parity: hide desktop nav')) {
    s = s.replace(
      '.app.app--web .home-web-nav {\n  display: none;\n}',
      `.app.app--web .home-web-nav {\n  /* WEB Mini App design parity: hide desktop nav */\n  display: none !important;\n}`
    )
  }
  // Strip pixel-ref blocks
  const cut = s.indexOf('/* ========== Pixel-ref Play (WEB) ========== */')
  if (cut >= 0) s = s.slice(0, cut).trimEnd() + '\n'
  fs.writeFileSync('src/styles/web-desktop.css', s)
  console.log('web-desktop phone shell')
}

// 4) Soften WEB app atmosphere toward Mini App page bg (still WEB shell class)
{
  let s = fs.readFileSync('src/App.css', 'utf8')
  s = s.replace(
`.app.app--web {
  --tg-header-offset: 0px;
  /* gnh-web-nebula-ref */
  background-color: #070814;
  background-image:
    radial-gradient(ellipse 80% 55% at 8% -8%, rgba(255, 79, 216, 0.28) 0%, transparent 55%),
    radial-gradient(ellipse 70% 50% at 95% 5%, rgba(76, 201, 255, 0.18) 0%, transparent 52%),
    radial-gradient(ellipse 75% 50% at 70% 100%, rgba(139, 92, 255, 0.22) 0%, transparent 55%),
    linear-gradient(165deg, #070814 0%, #0f1230 42%, #090b18 100%);
  background-attachment: fixed;
}`,
`.app.app--web {
  --tg-header-offset: 0px;
  /* Match Mini App page atmosphere; themed pages supply their own surfaces */
  background-color: var(--app-page-bg-color, #050816);
  background-image: var(--app-page-bg-image, none);
  background-attachment: scroll;
}`
  )
  // Disable aurora overlay for Mini App parity
  if (!s.includes('gnh-web-miniapp-parity')) {
    s = s.replace(
      '.app.app--web::after {',
      '.app.app--web::after {\n  /* gnh-web-miniapp-parity */\n  display: none;'
    )
  }
  fs.writeFileSync('src/App.css', s)
  console.log('App.css atmosphere')
}

// 5) Neutralize wide home composition overrides: wrap key media queries by forcing shell
// Add override at end: kill grid picks / hero desktop transforms for Mini App look
{
  const extra = `

/* ========== WEB = Mini App visual parity (design only) ========== */
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

/* Undo desktop WEB home redesign: keep Mini App strip/hero composition */
@media (min-width: 768px) {
  .app.app--web .home-neon-picks__list,
  .app.app--web .home-light-picks__list,
  .app.app--web .home-sunset-picks__list,
  .app.app--web .home-calm-picks__list,
  .app.app--web .home-web-picks__list {
    display: flex !important;
    flex-direction: column !important;
    grid-template-columns: none !important;
  }

  .app.app--web .home-neon-quick,
  .app.app--web .home-light-quick,
  .app.app--web .home-sunset-quick,
  .app.app--web .home-calm-quick {
    display: flex !important;
    flex-direction: column !important;
    grid-template-columns: none !important;
  }

  html[data-theme] .app.app--web .home-neon-picks__row,
  html[data-theme] .app.app--web .home-light-picks__row,
  html[data-theme] .app.app--web .home-sunset-picks__row,
  html[data-theme] .app.app--web .home-calm-picks__row {
    flex-direction: row !important;
    aspect-ratio: 869 / 100 !important;
    height: auto !important;
  }

  .app.app--web .home-neon-hero__card,
  .app.app--web .home-light-hero__card,
  .app.app--web .home-sunset-hero__card,
  .app.app--web .home-calm-hero__card {
    min-height: 0 !important;
  }

  .app.app--web .home-neon-hero__content,
  .app.app--web .home-light-hero__content,
  .app.app--web .home-sunset-hero__content,
  .app.app--web .home-calm-hero__content {
    max-width: none !important;
    background: none !important;
  }
}

@media (max-width: 767px) {
  .app.app--web .home-neon-picks__list,
  .app.app--web .home-light-picks__list,
  .app.app--web .home-sunset-picks__list,
  .app.app--web .home-calm-picks__list {
    display: flex !important;
    flex-direction: column !important;
    grid-template-columns: none !important;
  }
}
`
  let s = fs.readFileSync('src/styles/web-desktop.css', 'utf8')
  if (!s.includes('WEB = Mini App visual parity')) {
    fs.writeFileSync('src/styles/web-desktop.css', s.trimEnd() + '\n' + extra)
  }
  console.log('parity overrides appended')
}
