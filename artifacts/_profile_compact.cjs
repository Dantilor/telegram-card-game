const fs = require('fs')
const p = 'src/styles/web-desktop.css'
let s = fs.readFileSync(p, 'utf8')
if (!s.includes('profile compact composition')) {
  s = s.replace(
    '/* ========== PREMIUM ========== */',
    `/* Profile compact composition (desktop) */
@media (min-width: 1024px) {
  .app.app--web .profile-identity,
  .app.app--web .profile-pass,
  .app.app--web .profile-menu,
  .app.app--web .profile-alert {
    padding: 1rem 1.1rem;
    min-height: 0;
  }

  .app.app--web .profile-pass__desc {
    max-width: 42ch;
  }

  .app.app--web .profile-pass__email-input {
    max-width: 100%;
    min-height: 2.75rem;
  }

  .app.app--web .profile-pass__restore,
  .app.app--web .profile-pass__cta {
    min-height: 2.65rem;
  }

  .app.app--web .profile-pass__tg-code {
    letter-spacing: 0.18em;
    font-size: 1.35rem;
  }
}

/* ========== PREMIUM ========== */`
  )
  fs.writeFileSync(p, s)
  console.log('profile compact ok', fs.statSync(p).size)
} else {
  console.log('profile compact already present')
}
