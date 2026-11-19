const fs = require('fs')

// --- App.tsx: mount ThemeBackground ---
let app = fs.readFileSync('src/App.tsx', 'utf8')
if (!app.includes("ThemeBackground")) {
  app = app.replace(
    "import { isWebShell } from './config/shell'\n",
    "import { isWebShell } from './config/shell'\nimport { useTheme } from './hooks/useTheme'\nimport { ThemeBackground } from './components/ThemeBackground'\n"
  )
  app = app.replace(
    'function App() {\n  const [isReady, setReady] = useState(false)\n  useAppHeight()\n  useTelegramThemeSync()',
    'function App() {\n  const [isReady, setReady] = useState(false)\n  const [theme] = useTheme()\n  useAppHeight()\n  useTelegramThemeSync()'
  )
  app = app.replace(
    `<div className={\`app\${isReady ? ' is-ready' : ''}\${isWebShell() ? ' app--web' : ''}\`}>\n        <Suspense`,
    `<div className={\`app\${isReady ? ' is-ready' : ''}\${isWebShell() ? ' app--web' : ''}\`}>\n        <ThemeBackground theme={theme} />\n        <Suspense`
  )
  fs.writeFileSync('src/App.tsx', app)
  console.log('App.tsx patched')
} else {
  console.log('App.tsx already has ThemeBackground')
}

// --- App.css: exclude background from flex children ---
let css = fs.readFileSync('src/App.css', 'utf8')
if (!css.includes('gnh-theme-background')) {
  css = css.replace(
    `.app > * {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  width: 100%;
  max-width: 100%;
}`,
    `.app > *:not(.gnh-theme-background) {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  width: 100%;
  max-width: 100%;
}

.app > .gnh-theme-background {
  flex: none;
}`
  )
  fs.writeFileSync('src/App.css', css)
  console.log('App.css patched')
} else {
  console.log('App.css already mentions gnh-theme-background')
}

// --- theme.css: align fallback bases with pack, drop competing gradient washes to solid ---
let theme = fs.readFileSync('src/styles/theme.css', 'utf8')
const replacements = [
  [
    `--app-page-bg-color: #050816;
  --app-page-bg-image:
    radial-gradient(ellipse 120% 75% at 50% -18%, rgba(139, 77, 255, 0.16) 0%, rgba(139, 77, 255, 0.04) 42%, transparent 72%),
    radial-gradient(ellipse 85% 55% at 100% 12%, rgba(59, 130, 255, 0.08) 0%, transparent 68%),
    linear-gradient(180deg, #050816 0%, #060a1c 55%, #050816 100%);`,
    `--app-page-bg-color: #060a1b;
  --app-page-bg-image: none;`
  ],
  [
    `--app-page-bg-color: #f7f5ff;
  --app-page-bg-image:
    radial-gradient(ellipse 110% 70% at 50% -12%, rgba(255, 101, 216, 0.12) 0%, rgba(255, 101, 216, 0.03) 40%, transparent 70%),
    radial-gradient(ellipse 80% 50% at 85% 8%, rgba(85, 183, 255, 0.1) 0%, transparent 65%),
    linear-gradient(180deg, #fbfaff 0%, #f7f5ff 50%, #f4f2ff 100%);`,
    `--app-page-bg-color: #f6f4ff;
  --app-page-bg-image: none;`
  ],
]

let sunsetBlock = theme.match(/\[data-theme="sunset"\][\s\S]*?--app-page-bg-image:[\s\S]*?;/)
let calmBlock = theme.match(/\[data-theme="minimal-calm"\][\s\S]*?--app-page-bg-image:[\s\S]*?;/)

for (const [from, to] of replacements) {
  if (theme.includes(from)) {
    theme = theme.replace(from, to)
    console.log('replaced one theme bg block')
  } else {
    console.log('block not found exactly, will try softer replace')
  }
}

// Softer replaces for sunset/calm
theme = theme.replace(
  /\[data-theme="sunset"\][\s\S]*?--app-page-bg-color:\s*[^;]+;\s*--app-page-bg-image:[\s\S]*?;/,
  (m) => {
    if (m.includes('--app-page-bg-color')) {
      return m
        .replace(/--app-page-bg-color:\s*[^;]+;/, '--app-page-bg-color: #fff5f0;')
        .replace(/--app-page-bg-image:[\s\S]*?;/, '--app-page-bg-image: none;')
    }
    return m
  }
)

// Only replace within minimal-calm theme token block (the one with --bg0)
theme = theme.replace(
  /(\[data-theme="minimal-calm"\]\s*\{[\s\S]*?)--app-page-bg-color:\s*[^;]+;\s*--app-page-bg-image:[\s\S]*?;/,
  '$1--app-page-bg-color: #f5f7f6;\n  --app-page-bg-image: none;'
)

fs.writeFileSync('src/styles/theme.css', theme)
console.log('theme.css updated')
