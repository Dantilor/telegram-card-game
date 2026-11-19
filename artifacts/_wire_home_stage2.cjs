const fs = require('fs')

// Home.tsx → Stage2 layout
fs.writeFileSync('src/pages/Home.tsx', `import HomeWeb from './HomeWeb'

/** Home Stage 2 layout (carousel, quicks, popular/new rows). */
export default function Home() {
  return <HomeWeb />
}
`)
console.log('Home.tsx -> HomeWeb')

// Remove Mini App parity that hides nav / forces phone column for home
let w = fs.readFileSync('src/styles/web-desktop.css', 'utf8')
const marker = '/* ========== WEB = Mini App shell + cover picks ========== */'
const idx = w.indexOf(marker)
if (idx >= 0) {
  w = w.slice(0, idx) + `/* ========== WEB shell after Stage 2 home ========== */
.app.app--web .home-web-landing {
  max-width: min(72rem, 100%);
}

.app.app--web .home-web-nav {
  display: flex !important;
}

.app.app--web .games-page,
.app.app--web .profile-page,
.app.app--web .play-page,
.app.app--web .favorites-page {
  max-width: 29.375rem;
  margin-inline: auto;
}
`
  fs.writeFileSync('src/styles/web-desktop.css', w)
  console.log('web-desktop parity block replaced')
} else {
  console.log('marker missing, patching nav hide only')
  w = w.replace('.app.app--web .home-web-nav {\n  display: none !important;\n}', '.app.app--web .home-web-nav {\n  display: flex !important;\n}')
  fs.writeFileSync('src/styles/web-desktop.css', w)
}

// Clean Home.css WEB picks cover append if conflicting (harmless if Home unused)
