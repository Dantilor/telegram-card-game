const fs = require('fs')

// Append play/profile web polish to web-desktop.css
const extra = `

/* ========== Pixel-ref Play (WEB) ========== */
.app.app--web .play-page--web {
  position: relative;
  max-width: min(42rem, 100%);
  margin-inline: auto;
  padding-top: 0.5rem;
  font-family: var(--gnh-font-ui, "Inter", "Manrope", system-ui, sans-serif);
}

.app.app--web .play-page--web::before,
.app.app--web .play-page--web::after {
  content: "";
  position: absolute;
  width: 7rem;
  height: 9rem;
  border-radius: 1rem;
  border: 1px solid rgba(255, 79, 216, 0.22);
  opacity: 0.35;
  pointer-events: none;
  filter: blur(0.2px);
}

.app.app--web .play-page--web::before {
  left: -1.5rem;
  top: 28%;
  transform: rotate(-18deg);
  box-shadow: 0 0 24px rgba(139, 92, 255, 0.25);
}

.app.app--web .play-page--web::after {
  right: -1.5rem;
  top: 36%;
  transform: rotate(14deg);
  border-color: rgba(76, 201, 255, 0.28);
}

.app.app--web .play-page--web .play-page__title {
  font-family: var(--gnh-font-display, "Montserrat", sans-serif);
  font-size: clamp(1.35rem, 1.1rem + 0.8vw, 1.85rem);
  text-align: center;
}

.app.app--web .play-page--web .play-page__progress-wrap {
  max-width: 18rem;
  margin-inline: auto;
}

.app.app--web .play-page--web .play-page__progress-fill {
  background: linear-gradient(90deg, #ff4fd8, #8b5cff, #4cc9ff);
  box-shadow: 0 0 12px rgba(255, 79, 216, 0.45);
}

.app.app--web .play-page--web .play-card {
  border-radius: 1.5rem;
  border: 1.5px solid transparent;
  background:
    linear-gradient(160deg, rgba(18, 16, 40, 0.92), rgba(12, 14, 32, 0.88)) padding-box,
    linear-gradient(135deg, rgba(255, 79, 216, 0.95), rgba(139, 92, 255, 0.85), rgba(76, 201, 255, 0.75)) border-box;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.04) inset, 0 18px 48px rgba(0, 0, 0, 0.35), 0 0 36px rgba(139, 92, 255, 0.22);
}

.app.app--web .play-page--web .play-card__inner {
  padding: clamp(1.35rem, 2.4vw, 2rem) clamp(1.2rem, 2.2vw, 1.85rem);
  min-height: 0;
}

.app.app--web .play-page--web .play-card__text {
  font-size: clamp(1.45rem, 1.15rem + 1.1vw, 2.05rem);
  line-height: 1.35;
  max-width: 28ch;
  margin-inline: auto;
  text-align: center;
}

.app.app--web .play-page--web .play-page__cta {
  border-radius: 999px;
  background: linear-gradient(110deg, #ff4fd8, #8b5cff 55%, #6d7cff);
  box-shadow: 0 12px 28px rgba(139, 92, 255, 0.4);
  min-height: 3rem;
  font-weight: 700;
}

.app.app--web .play-page--web .play-page__fav-btn {
  border-radius: 999px;
  border: 1px solid rgba(196, 181, 253, 0.35);
  background: rgba(255, 255, 255, 0.06);
}

.app.app--web .play-page--web .play-page__prev-btn {
  background: transparent;
  color: rgba(196, 181, 253, 0.85);
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* ========== Pixel-ref Profile (WEB) ========== */
.app.app--web .profile-page--web {
  max-width: min(72rem, 100%);
  font-family: var(--gnh-font-ui, "Inter", system-ui, sans-serif);
}

.app.app--web .profile-page--web .profile-shell {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  gap: 1rem 1.25rem;
  align-items: start;
}

.app.app--web .profile-page--web .profile-identity,
.app.app--web .profile-page--web .profile-pass,
.app.app--web .profile-page--web .profile-menu,
.app.app--web .profile-page--web .profile-aside > * {
  border-radius: 1.35rem;
  border: 1px solid rgba(180, 160, 255, 0.2);
  background: rgba(16, 18, 40, 0.62);
  backdrop-filter: blur(16px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);
}

.app.app--web .profile-page--web .profile-identity__badge--pro {
  background: linear-gradient(110deg, #fbbf24, #f59e0b);
  color: #1f1408;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.app.app--web .profile-page--web .profile-pass--email {
  opacity: 0.85;
}

.app.app--web .profile-page--web .profile-pass__eyebrow {
  letter-spacing: 0.12em;
}

@media (max-width: 899px) {
  .app.app--web .profile-page--web .profile-shell {
    grid-template-columns: 1fr;
  }
  .app.app--web .play-page--web::before,
  .app.app--web .play-page--web::after {
    display: none;
  }
}
`

let desk = fs.readFileSync('src/styles/web-desktop.css', 'utf8')
if (!desk.includes('Pixel-ref Play')) {
  fs.writeFileSync('src/styles/web-desktop.css', desk + extra)
  console.log('desktop extras ok')
}

// Stronger neon web atmosphere
let app = fs.readFileSync('src/App.css', 'utf8')
if (!app.includes('gnh-web-nebula-ref')) {
  app = app.replace(
`.app.app--web {
  --tg-header-offset: 0px;
  background-color: #12101c;
  background-image:
    radial-gradient(ellipse 90% 60% at 12% -10%, rgba(124, 58, 237, 0.38) 0%, transparent 55%),
    radial-gradient(ellipse 70% 50% at 92% 8%, rgba(56, 189, 248, 0.18) 0%, transparent 50%),
    radial-gradient(ellipse 80% 55% at 70% 95%, rgba(168, 85, 247, 0.22) 0%, transparent 55%),
    linear-gradient(165deg, #0f0d18 0%, #1a1528 42%, #12101c 100%);
  background-attachment: fixed;
}`,
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
}`
  )
  fs.writeFileSync('src/App.css', app)
  console.log('app atmosphere ok')
}

// HomeWebNav active state via location
let nav = fs.readFileSync('src/components/HomeWebNav.tsx', 'utf8')
if (!nav.includes('useLocation')) {
  nav = nav.replace(
    "import { Link } from 'react-router-dom'",
    "import { Link, useLocation } from 'react-router-dom'"
  )
  nav = nav.replace(
    'export default function HomeWebNav({ onPremium }: HomeWebNavProps) {\n  return (',
    `export default function HomeWebNav({ onPremium }: HomeWebNavProps) {
  const { pathname } = useLocation()
  const gamesActive = pathname.startsWith('/games')
  const profileActive = pathname.startsWith('/profile')
  const premiumActive = pathname.startsWith('/premium')
  return (`
  )
  nav = nav.replace(
    'className="home-web-nav__link home-web-nav__link--cta"',
    'className={`home-web-nav__link${gamesActive ? \' home-web-nav__link--cta is-active\' : \'\'}`}'
  )
  nav = nav.replace(
    '<Link to="/profile" className="home-web-nav__link" onClick={() => haptic(\'light\')}>',
    '<Link to="/profile" className={`home-web-nav__link${profileActive ? \' is-active\' : \'\'}`} onClick={() => haptic(\'light\')}>'
  )
  nav = nav.replace(
    '<Link to="/premium" className="home-web-nav__link" onClick={() => haptic(\'light\')}>',
    '<Link to="/premium" className={`home-web-nav__link${premiumActive ? \' is-active\' : \'\'}`} onClick={() => haptic(\'light\')}>'
  )
  fs.writeFileSync('src/components/HomeWebNav.tsx', nav)
  console.log('nav active ok')
}
