const fs = require('fs')
let app = fs.readFileSync('src/App.tsx', 'utf8')

if (!app.includes("from './hooks/useTheme'")) {
  app = app.replace(
    "import { WebAuthGate } from './shell/WebAuthGate'\r\n",
    "import { WebAuthGate } from './shell/WebAuthGate'\r\nimport { useTheme } from './hooks/useTheme'\r\nimport { ThemeBackground } from './components/ThemeBackground'\r\n"
  )
}
if (!app.includes("from './hooks/useTheme'")) {
  app = app.replace(
    "import { WebAuthGate } from './shell/WebAuthGate'\n",
    "import { WebAuthGate } from './shell/WebAuthGate'\nimport { useTheme } from './hooks/useTheme'\nimport { ThemeBackground } from './components/ThemeBackground'\n"
  )
}
if (!app.includes('const [theme] = useTheme()')) {
  app = app.replace(
    'const [isReady, setReady] = useState(false)\r\n  useAppHeight()',
    'const [isReady, setReady] = useState(false)\r\n  const [theme] = useTheme()\r\n  useAppHeight()'
  )
}
if (!app.includes('const [theme] = useTheme()')) {
  app = app.replace(
    'const [isReady, setReady] = useState(false)\n  useAppHeight()',
    'const [isReady, setReady] = useState(false)\n  const [theme] = useTheme()\n  useAppHeight()'
  )
}
fs.writeFileSync('src/App.tsx', app)
console.log({
  importTheme: app.includes("from './hooks/useTheme'"),
  importBg: app.includes('ThemeBackground'),
  hook: app.includes('const [theme] = useTheme()'),
  jsx: app.includes('<ThemeBackground theme={theme}')
})
