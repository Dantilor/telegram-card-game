const fs = require('fs')
let css = fs.readFileSync('src/components/ThemeToggle.css', 'utf8')
const before = css.length
css = css
  .replaceAll('.home-page--neon', '.home-web-landing')
  .replaceAll('.home-page--light', '.home-web-landing')
  .replaceAll('.home-page--sunset', '.home-web-landing')
  .replaceAll('.home-page--calm', '.home-web-landing')
fs.writeFileSync('src/components/ThemeToggle.css', css)
console.log('theme toggle retargeted', before, '->', css.length)

// Also HomePremiumBanner / HomeWelcomeTop if scoped to home-page
