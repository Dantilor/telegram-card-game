const fs = require('fs')

// App.tsx
let app = fs.readFileSync('src/App.tsx', 'utf8')
if (!app.includes('ThemeBackground')) {
  if (!app.includes("from './hooks/useTheme'")) {
    app = app.replace(
      "import { WebAuthGate } from './shell/WebAuthGate'\n",
      "import { WebAuthGate } from './shell/WebAuthGate'\nimport { useTheme } from './hooks/useTheme'\nimport { ThemeBackground } from './components/ThemeBackground'\n"
    )
  }
  app = app.replace(
    'const [isReady, setReady] = useState(false)\n  useAppHeight()',
    'const [isReady, setReady] = useState(false)\n  const [theme] = useTheme()\n  useAppHeight()'
  )
  app = app.replace(
    '      <div className={`app${isReady ? \' is-ready\' : \'\'}${isWebShell() ? \' app--web\' : \'\'}`}>\n        <Suspense',
    '      <div className={`app${isReady ? \' is-ready\' : \'\'}${isWebShell() ? \' app--web\' : \'\'}`}>\n        <ThemeBackground theme={theme} />\n        <Suspense'
  )
  // try alternate quote style from file
  if (!app.includes('<ThemeBackground')) {
    app = app.replace(
      /(<div className=\{`app\$\{isReady \? ' is-ready' : ''\}\$\{isWebShell\(\) \? ' app--web' : ''\}`}>\s*)(<Suspense)/,
      '$1<ThemeBackground theme={theme} />\n        $2'
    )
  }
  fs.writeFileSync('src/App.tsx', app)
  console.log('App patched, has ThemeBackground:', app.includes('<ThemeBackground'))
} else console.log('already')

// theme.css neon + light
let theme = fs.readFileSync('src/styles/theme.css', 'utf8')
theme = theme.replace(
  /(:root,\s*\[data-theme="neon-dark"\]\s*\{[\s\S]*?)--app-page-bg-color:\s*[^;]+;\s*--app-page-bg-image:[\s\S]*?;/,
  '$1--app-page-bg-color: #060a1b;\n  --app-page-bg-image: none;'
)
theme = theme.replace(
  /(\[data-theme="neon-light"\]\s*\{[\s\S]*?)--app-page-bg-color:\s*[^;]+;\s*--app-page-bg-image:[\s\S]*?;/,
  '$1--app-page-bg-color: #f6f4ff;\n  --app-page-bg-image: none;'
)
fs.writeFileSync('src/styles/theme.css', theme)
console.log('theme bg colors:', [...theme.matchAll(/--app-page-bg-color:[^;]+/g)].map(m=>m[0]))

// App.css web shell transparent
let appCss = fs.readFileSync('src/App.css', 'utf8')
appCss = appCss.replace(
  `.app.app--web {
  --tg-header-offset: 0px;
  /* Match Mini App page atmosphere; themed pages supply their own surfaces */
  background-color: var(--app-page-bg-color, #050816);
  background-image: var(--app-page-bg-image, none);
  background-attachment: scroll;
}`,
  `.app.app--web {
  --tg-header-offset: 0px;
  /* Theme photo decor lives in ThemeBackground; keep shell transparent */
  background-color: transparent;
  background-image: none;
  background-attachment: scroll;
}`
)
fs.writeFileSync('src/App.css', appCss)
console.log('App.css web bg updated')
