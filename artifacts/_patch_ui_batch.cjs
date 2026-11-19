const fs = require('fs')

let s = fs.readFileSync('src/styles/web-desktop.css', 'utf8')
s = s.replace(
  'rgba(5, 8, 22, 0.28) 0%, rgba(5, 8, 22, 0.08) 38%',
  'rgba(5, 8, 22, 0.18) 0%, rgba(5, 8, 22, 0.05) 38%'
)
s = s.replace(
  'transparent 55%, rgba(5, 8, 22, 0.18) 100%',
  'transparent 58%, rgba(5, 8, 22, 0.12) 100%'
)

if (!s.includes('WEB mobile safe-area polish')) {
  s += `

/* ========== WEB mobile safe-area polish ========== */
.app.app--web {
  padding-bottom: max(var(--pad), env(safe-area-inset-bottom, 0px));
}

.app.app--web .premium-overlay,
.app.app--web .document-modal {
  padding-top: max(0.75rem, env(safe-area-inset-top, 0px));
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom, 0px));
}

.app.app--web .premium-overlay__card {
  max-height: min(92dvh, 100%);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: max(1rem, env(safe-area-inset-bottom, 0px));
}

.app.app--web .profile-page {
  width: 100%;
  max-width: min(100%, var(--web-shell-max));
  overflow-x: hidden;
}

.app.app--web .profile-pass__email-input,
.app.app--web input[type="email"],
.app.app--web input[type="text"] {
  font-size: 16px; /* iOS Safari: avoid zoom-on-focus */
}

@media (max-width: 767px) {
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
  }

  .app.app--web .home-neon-picks__thumb,
  .app.app--web .home-light-picks__thumb,
  .app.app--web .home-sunset-picks__thumb,
  .app.app--web .home-calm-picks__thumb {
    width: 100%;
    aspect-ratio: 4 / 5;
    border-radius: 0;
  }
}
`
}

fs.writeFileSync('src/styles/web-desktop.css', s)
console.log('desktop ok', fs.statSync('src/styles/web-desktop.css').size)

// App.css import
let app = fs.readFileSync('src/App.css', 'utf8')
if (!app.includes('web-tokens.css')) {
  app = app.replace(
    '@import "./styles/responsive.css";',
    '@import "./styles/responsive.css";\n@import "./styles/web-tokens.css";'
  )
  fs.writeFileSync('src/App.css', app)
  console.log('app import ok')
}

// responsive comment
let r = fs.readFileSync('src/styles/responsive.css', 'utf8')
r = r.replace(
  'Telegram Mini App + WEB both stay a centered phone column (WEB via web-desktop.css).',
  'Telegram Mini App stays a centered phone column; WEB uses web-desktop.css wide shell.'
)
fs.writeFileSync('src/styles/responsive.css', r)
console.log('responsive ok')
