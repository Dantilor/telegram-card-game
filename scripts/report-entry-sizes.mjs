#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

function report(dir) {
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8')
  const js = (html.match(/assets\/(index-[^"']+\.js)/) || [])[1]
  const css = (html.match(/assets\/(index-[^"']+\.css)/) || [])[1]
  const assetsDir = path.join(dir, 'assets')
  const files = fs.readdirSync(assetsDir).map((name) => {
    const filePath = path.join(assetsDir, name)
    const raw = fs.statSync(filePath).size
    return { name, raw }
  })
  files.sort((a, b) => b.raw - a.raw)

  const compress = (file) => {
    const buf = fs.readFileSync(path.join(assetsDir, file))
    return {
      raw: buf.length,
      gzip: zlib.gzipSync(buf, { level: 9 }).length,
      brotli: typeof zlib.brotliCompressSync === 'function' ? zlib.brotliCompressSync(buf).length : null,
    }
  }

  const fontFacesInCss = css
    ? (fs.readFileSync(path.join(assetsDir, css), 'utf8').match(/@font-face/g) || []).length
    : 0

  return {
    dir,
    entryJs: js ? { name: js, ...compress(js) } : null,
    entryCss: css ? { name: css, ...compress(css) } : null,
    fontFacesInEntryCss: fontFacesInCss,
    top25: files.slice(0, 25),
  }
}

const dirs = process.argv.slice(2)
const targets = dirs.length ? dirs : ['dist']
console.log(JSON.stringify(targets.map(report), null, 2))
