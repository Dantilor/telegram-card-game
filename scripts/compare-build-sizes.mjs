import fs from 'node:fs'
import path from 'node:path'

function entry(dir) {
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8')
  const js = (html.match(/assets\/(index-[^"']+\.js)/) || [])[1]
  const css = (html.match(/assets\/(index-[^"']+\.css)/) || [])[1]
  const assets = fs.readdirSync(path.join(dir, 'assets'))
  const fonts = assets.filter((f) => /manrope|unbounded/.test(f) && f.endsWith('.woff2'))
  const asyncChunks = assets.filter((f) => /PremiumOverlay|LegalChoices|LegalDocumentView|legal-ui|premium-overlay/.test(f) && f.endsWith('.js'))
  const cssFiles = assets.filter((f) => f.endsWith('.css'))
  return {
    js,
    css,
    jsBytes: js ? fs.statSync(path.join(dir, 'assets', js)).size : null,
    cssBytes: css ? fs.statSync(path.join(dir, 'assets', css)).size : null,
    cssFileCount: cssFiles.length,
    cssTotalBytes: cssFiles.reduce((s, f) => s + fs.statSync(path.join(dir, 'assets', f)).size, 0),
    woff2Count: fonts.length,
    woff2Bytes: fonts.reduce((s, f) => s + fs.statSync(path.join(dir, 'assets', f)).size, 0),
    asyncChunks,
    asyncChunkBytes: asyncChunks.reduce((s, f) => s + fs.statSync(path.join(dir, 'assets', f)).size, 0),
  }
}

console.log(JSON.stringify({ before: entry('dist-before'), after: entry('dist') }, null, 2))
