const fs = require('fs')
let home = fs.readFileSync('src/pages/Home.css', 'utf8')

const blocks = [
  [
`html[data-theme="neon-light"],
html[data-theme="neon-light"] body,
html[data-theme="neon-light"] #root {
  background-color: #f7f5ff;
  background-image:
    radial-gradient(circle at 20% 0%, rgba(255, 101, 216, 0.1), transparent 34%),
    radial-gradient(circle at 80% 20%, rgba(85, 183, 255, 0.12), transparent 38%),
    linear-gradient(180deg, #fbfaff 0%, #f7f5ff 48%, #f4f2ff 100%);
  background-attachment: fixed;
}`,
`html[data-theme="neon-light"],
html[data-theme="neon-light"] body,
html[data-theme="neon-light"] #root {
  background-color: #f6f4ff;
  background-image: none;
}`
  ],
  [
`html[data-theme="sunset"],
html[data-theme="sunset"] body,
html[data-theme="sunset"] #root {
  background-color: #fff5f0;
  background-image:
    radial-gradient(circle at 20% 0%, rgba(255, 154, 139, 0.12), transparent 34%),
    radial-gradient(circle at 80% 20%, rgba(255, 153, 172, 0.1), transparent 38%),
    linear-gradient(180deg, #fff8f4 0%, #fff5f0 48%, #fff0ea 100%);
  background-attachment: fixed;
}`,
`html[data-theme="sunset"],
html[data-theme="sunset"] body,
html[data-theme="sunset"] #root {
  background-color: #fff5f0;
  background-image: none;
}`
  ],
  [
`html[data-theme="minimal-calm"],
html[data-theme="minimal-calm"] body,
html[data-theme="minimal-calm"] #root {
  background-color: #f7f8f7;
  background-image:
    radial-gradient(circle at 20% 0%, rgba(139, 168, 150, 0.08), transparent 34%),
    radial-gradient(circle at 80% 20%, rgba(168, 181, 196, 0.1), transparent 38%),
    linear-gradient(180deg, #f9faf9 0%, #f7f8f7 48%, #f3f5f4 100%);
  background-attachment: fixed;
}`,
`html[data-theme="minimal-calm"],
html[data-theme="minimal-calm"] body,
html[data-theme="minimal-calm"] #root {
  background-color: #f5f7f6;
  background-image: none;
}`
  ],
]

for (const [from, to] of blocks) {
  if (home.includes(from)) {
    home = home.replace(from, to)
    console.log('replaced home html bg block')
  } else {
    console.log('MISSING block')
  }
}
fs.writeFileSync('src/pages/Home.css', home)

// Soften profile page ::before gradients to solid bases matching pack
let profile = fs.readFileSync('src/pages/Profile.css', 'utf8')
profile = profile.replace(
  /--profile-page-bg-image:\s*[\s\S]*?;/g,
  '--profile-page-bg-image: none;'
)
profile = profile.replace('--profile-page-bg-color: #050816;', '--profile-page-bg-color: #060a1b;')
fs.writeFileSync('src/pages/Profile.css', profile)
console.log('profile bg images cleared')
