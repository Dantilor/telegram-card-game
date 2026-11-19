const fs = require('fs')
const p = 'src/styles/web-desktop.css'
let s = fs.readFileSync(p, 'utf8')
if (s.charCodeAt(0) === 0xfeff) s = s.slice(1)
s = s.replace(
  'Standalone WEB desktop / tablet layout.',
  'WEB desktop/tablet layout (shell max ~1440px).'
)
s = s.replaceAll('min(100% - 2.5rem, 64rem)', 'min(100% - 2rem, 72rem)')
s = s.replaceAll('min(100% - 3rem, 72rem)', 'min(100% - 2.5rem, 80rem)')
s = s.replaceAll('min(100% - 3.5rem, 82rem)', 'min(100% - 3rem, 90rem)')
s = s.replaceAll('min(100% - 4rem, 96rem)', 'min(100% - 3.5rem, 90rem)')
const inject = [
  '  /* Force-kill Mini App strip ratio on WEB (all themes) */',
  '  html[data-theme] .app.app--web .home-neon-picks__row,',
  '  html[data-theme] .app.app--web .home-light-picks__row,',
  '  html[data-theme] .app.app--web .home-sunset-picks__row,',
  '  html[data-theme] .app.app--web .home-calm-picks__row {',
  '    aspect-ratio: auto !important;',
  '    min-height: 0 !important;',
  '    height: auto !important;',
  '  }',
  '',
].join('\n')
if (!s.includes('Force-kill Mini App strip ratio')) {
  s = s.replace(
    '    /* Critical: TG Home.css uses 869/100 which collapses covers into strips */',
    inject + '    /* Critical: TG Home.css uses 869/100 which collapses covers into strips */'
  )
}
fs.writeFileSync(p, s)
console.log('ok', fs.statSync(p).size)
console.log((s.match(/web-shell-max: min[^;]+/g) || []).join('\n'))
