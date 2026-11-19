const fs = require('fs')
let css = fs.readFileSync('src/pages/HomeWeb.css', 'utf8')
const start = css.indexOf('.home-web-game-card__media .home-web-game-card__play')
const end = css.indexOf('/* New games — landscape cards */')
if (start > 0 && end > start) {
  css = css.slice(0, start) + css.slice(end)
  fs.writeFileSync('src/pages/HomeWeb.css', css)
  console.log('cleaned hacky play css')
} else console.log('markers', start, end)

// Ensure HomeWebNav visible when landing is used
let nav = fs.readFileSync('src/components/HomeWebNav.css', 'utf8')
nav = `/* Shown whenever Stage 2 home is mounted; themed by HomeWeb.css */
.home-web-nav {
  display: flex;
}
`
fs.writeFileSync('src/components/HomeWebNav.css', nav)
console.log('nav css updated')
