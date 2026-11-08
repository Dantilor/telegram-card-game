import fs from 'node:fs'
import path from 'node:path'

const dir = path.join(process.cwd(), 'dist-web', 'assets')
const file = fs.readdirSync(dir).find((x) => x.startsWith('index-') && x.endsWith('.js') && !x.includes('legacy'))
const s = fs.readFileSync(path.join(dir, file), 'utf8')
console.log('file', file)
console.log('login btn', s.includes('Войти через Telegram'))
console.log('web-auth-gate', s.includes('web-auth-gate'))
console.log('has web shell string', s.includes('gnh_shell') || s.includes('GNH_SHELL'))
console.log('BrowserRouter hint', s.includes('createBrowserRouter') || s.includes('BrowserRouter') || s.includes('basename'))
