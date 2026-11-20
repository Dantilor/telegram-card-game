#!/usr/bin/env node
/**
 * Compress WEB-critical heavy assets (>500KB) without changing composition.
 * Run: node scripts/optimize-web-heavy-assets.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const report = []

async function encodeWebp(input, output, { width, quality = 78 } = {}) {
  if (!fs.existsSync(input)) {
    console.warn('skip missing', input)
    return
  }
  const before = fs.statSync(input).size
  const meta = await sharp(input).metadata()
  const targetWidth = width ? Math.min(width, meta.width ?? width) : meta.width
  await sharp(input)
    .resize({ width: targetWidth, withoutEnlargement: true })
    .webp({ quality, effort: 6, alphaQuality: 90 })
    .toFile(output)
  const after = fs.statSync(output).size
  const row = {
    input: path.relative(root, input).replaceAll('\\', '/'),
    output: path.relative(root, output).replaceAll('\\', '/'),
    beforeKB: Math.round(before / 1024),
    afterKB: Math.round(after / 1024),
    width: targetWidth,
  }
  report.push(row)
  console.log(`${row.input} ${row.beforeKB}KB -> ${row.output} ${row.afterKB}KB (w=${row.width})`)
}

async function recompressWebpInPlace(file, { width, quality = 72 } = {}) {
  const before = fs.statSync(file).size
  const meta = await sharp(file).metadata()
  const targetWidth = width ? Math.min(width, meta.width ?? width) : meta.width
  const tmp = `${file}.tmp.webp`
  await sharp(file)
    .resize({ width: targetWidth, withoutEnlargement: true })
    .webp({ quality, effort: 6, alphaQuality: 90 })
    .toFile(tmp)
  const after = fs.statSync(tmp).size
  if (after < before * 0.92) {
    fs.copyFileSync(tmp, file)
    fs.unlinkSync(tmp)
  } else {
    fs.unlinkSync(tmp)
  }
  const finalSize = fs.statSync(file).size
  const row = {
    input: path.relative(root, file).replaceAll('\\', '/'),
    output: path.relative(root, file).replaceAll('\\', '/'),
    beforeKB: Math.round(before / 1024),
    afterKB: Math.round(finalSize / 1024),
    width: targetWidth,
  }
  report.push(row)
  console.log(`recompress ${row.input} ${row.beforeKB}KB -> ${row.afterKB}KB (w=${row.width})`)
}

const onlyRecompress = process.argv.includes('--recompress-only')

if (!onlyRecompress) {
  await encodeWebp(
    path.join(root, 'public/games/infected/station-containment.png'),
    path.join(root, 'public/games/infected/station-containment.webp'),
    { width: 1600, quality: 76 }
  )
  await encodeWebp(
    path.join(root, 'public/games/mafia-shadows/mafia-hero.png'),
    path.join(root, 'public/games/mafia-shadows/mafia-hero.webp'),
    { width: 1600, quality: 76 }
  )
  await encodeWebp(
    path.join(root, 'src/assets/gnh-loading-crystal.png'),
    path.join(root, 'src/assets/gnh-loading-crystal.webp'),
    { width: 512, quality: 80 }
  )
  await encodeWebp(
    path.join(root, 'public/brand/gnh-loading-crystal.png'),
    path.join(root, 'public/brand/gnh-loading-crystal.webp'),
    { width: 512, quality: 80 }
  )
}

const recompress = [
  ['src/assets/optimized/catalog-who-is-who-desktop.webp', 900, 70],
  ['src/assets/optimized/catalog-who-is-who.webp', 720, 70],
  ['src/assets/optimized/catalog-russia-travel.webp', 720, 70],
  ['src/assets/optimized/catalog-russia-travel-desktop.webp', 900, 70],
  ['src/assets/optimized/catalog-card-game-desktop.webp', 900, 72],
  ['src/assets/optimized/catalog-infected.webp', 900, 74],
  ['src/assets/optimized/catalog-mafia-shadows.webp', 900, 74],
]

for (const [rel, width, quality] of recompress) {
  const file = path.join(root, rel)
  if (fs.existsSync(file) && fs.statSync(file).size > 400 * 1024) {
    await recompressWebpInPlace(file, { width, quality })
  }
}

const out = path.join(root, 'artifacts/web-image-opt-report.json')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify(report, null, 2))
console.log(`\nWrote ${path.relative(root, out)}`)
