const fs = require('fs')
let home = fs.readFileSync('src/pages/Home.css', 'utf8')

function stripHtmlBg(themeAttr, color) {
  const re = new RegExp(
    `html\\[data-theme="${themeAttr}"\\],[\\s\\S]*?html\\[data-theme="${themeAttr}"\\] #root \\{[\\s\\S]*?\\}`,
    'm'
  )
  if (!re.test(home)) {
    console.log('no match', themeAttr)
    return
  }
  home = home.replace(
    re,
    `html[data-theme="${themeAttr}"],\nhtml[data-theme="${themeAttr}"] body,\nhtml[data-theme="${themeAttr}"] #root {\n  background-color: ${color};\n  background-image: none;\n}`
  )
  console.log('ok', themeAttr)
}

stripHtmlBg('neon-light', '#f6f4ff')
stripHtmlBg('sunset', '#fff5f0')
stripHtmlBg('minimal-calm', '#f5f7f6')
fs.writeFileSync('src/pages/Home.css', home)
