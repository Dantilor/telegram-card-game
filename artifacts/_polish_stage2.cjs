const fs = require('fs')

// App padding: Stage2 home should breathe edge-to-edge like reference phone column
let appCss = fs.readFileSync('src/App.css', 'utf8')
if (!appCss.includes('app:has(.home-web-landing)')) {
  appCss += `

.app:has(.home-web-landing) {
  padding-left: max(0.65rem, var(--safe-left, 0px));
  padding-right: max(0.65rem, var(--safe-right, 0px));
  padding-bottom: max(0.75rem, var(--safe-bottom, 0px));
}

@media (min-width: 900px) {
  .app:has(.home-web-landing) {
    padding-left: max(1.25rem, var(--safe-left, 0px));
    padding-right: max(1.25rem, var(--safe-right, 0px));
  }
}
`
  fs.writeFileSync('src/App.css', appCss)
  console.log('app padding for landing')
}

let css = fs.readFileSync('src/pages/HomeWeb.css', 'utf8')

// Stronger left-side hero copy + taller mobile hero
css = css.replace(
  `.home-web-hero__veil {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(6, 8, 22, 0.86) 0%, rgba(6, 8, 22, 0.5) 42%, rgba(6, 8, 22, 0.15) 70%, transparent 100%),
    linear-gradient(180deg, transparent 50%, rgba(6, 8, 22, 0.45) 100%);
  pointer-events: none;
}`,
  `.home-web-hero__veil {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(105deg, rgba(6, 8, 22, 0.9) 0%, rgba(6, 8, 22, 0.62) 38%, rgba(6, 8, 22, 0.18) 62%, transparent 82%),
    linear-gradient(180deg, transparent 48%, rgba(6, 8, 22, 0.55) 100%);
  pointer-events: none;
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
  max-width: min(36rem, 92%);
}`,
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
}`
)

// Theme toggle stretch
if (!css.includes('home-web-landing__themes .theme-toggle')) {
  css = css.replace(
    `.home-web-landing__themes .theme-toggle-wrap {
  width: 100%;
}`,
    `.home-web-landing__themes .theme-toggle-wrap {
  width: 100%;
}

.home-web-landing__themes .theme-toggle {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.35rem;
}

.home-web-landing__themes .theme-toggle__btn {
  width: 100%;
  justify-content: center;
}`
  )
}

fs.writeFileSync('src/pages/HomeWeb.css', css)
console.log('css polished')
