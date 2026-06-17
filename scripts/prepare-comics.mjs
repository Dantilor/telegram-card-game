#!/usr/bin/env node
/**
 * Dev-only: PDF comics → optimized WebP pages in public/comics/
 * Requires: poppler (pdftoppm), webp (cwebp)
 * macOS: brew install poppler webp
 */

import { execSync, spawnSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const ZIP_PATH = join(ROOT, 'incoming', 'Комиксы.zip')
const SOURCE_DIR = join(ROOT, 'incoming', 'comics-source')
const EXTRA_SOURCE_DIR = join(ROOT, 'incoming', 'comics-extra')
const PUBLIC_COMICS = join(ROOT, 'public', 'comics')
const TEMP_DIR = join(ROOT, 'incoming', '.comics-tmp')

const WEBP_QUALITY = 82
const TARGET_WIDTH = 1200
const DEFAULT_PAGE_COUNT = 16

const SERIES = [
  {
    id: 'series-1',
    pdf: 'GameNight_Host_Seriya1_Komiks_FLIPBOOK_16pages_HQ.pdf',
  },
  {
    id: 'series-2',
    pdf: 'GameNight_Host_Seriya2_Neobitaemiy_Vaib_16pages_UPDATED.pdf',
  },
  {
    id: 'series-3',
    pdf: 'GameNight_Host_Seriya3_Bunkerniy_Vibe_16pages_HQ.pdf',
  },
  {
    id: 'series-4',
    pdf: 'GameNight_Host_Seriya4_Dom_s_Sekretami_16pages_UPDATED.pdf',
  },
  {
    id: 'series-5',
    pdf: 'Train_No_Stops_GNH_Comic_v2.pdf',
    pages: 10,
    coverRatio: '3/4',
  },
  {
    id: 'series-6',
    pdf: 'Train_No_Stops_Part2_GNH_Comic_Final.pdf',
    pages: 10,
    coverRatio: '3/4',
  },
  {
    id: 'series-7',
    pdf: 'GNH_Seriya7_Sad_Bolshih_Priklyucheniy.pdf',
    pages: 10,
    coverRatio: '3/4',
  },
  {
    id: 'series-8',
    pdf: 'GNH_Seriya8_Kosmicheskiy_Reys.pdf',
    pages: 10,
    coverRatio: '3/4',
  },
  {
    id: 'series-9',
    pdf: 'GNH_Seriya9_Pikselny_Mir.pdf',
    pages: 10,
    coverRatio: '3/4',
  },
  {
    id: 'series-10',
    pdf: 'GNH_Seriya10_Dinopark.pdf',
    pages: 10,
    coverRatio: '3/4',
  },
]

const MACOS_INSTALL_HINT = `
Required tools not found. Install on macOS:

  brew install poppler webp

Then run:

  npm run prepare:comics
`.trim()

function log(msg) {
  console.log(msg)
}

function fail(msg) {
  console.error(`\n[prepare-comics] ERROR: ${msg}`)
  process.exit(1)
}

function commandExists(cmd) {
  try {
    execSync(`command -v ${cmd}`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function findCommand(cmd) {
  if (!commandExists(cmd)) return null
  return execSync(`command -v ${cmd}`, { encoding: 'utf8' }).trim()
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function walkFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    if (entry.name === '__MACOSX') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      walkFiles(full, acc)
    } else if (entry.isFile()) {
      acc.push(full)
    }
  }
  return acc
}

function unzipArchive() {
  if (!existsSync(ZIP_PATH)) {
    fail(`Archive not found: ${ZIP_PATH}\nPlace Комиксы.zip into incoming/Комиксы.zip`)
  }

  rmSync(SOURCE_DIR, { recursive: true, force: true })
  mkdirSync(SOURCE_DIR, { recursive: true })

  log(`Extracting ${ZIP_PATH} → ${SOURCE_DIR}`)
  const result = spawnSync('unzip', ['-q', ZIP_PATH, '-d', SOURCE_DIR], {
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    fail('unzip failed')
  }
}

function findPdfByName(filename) {
  const sourceFiles = [...walkFiles(SOURCE_DIR), ...walkFiles(EXTRA_SOURCE_DIR)]
  const matches = sourceFiles.filter(
    (f) => basename(f) === filename && !f.includes('__MACOSX') && !basename(f).startsWith('._')
  )
  if (matches.length === 0) return null
  if (matches.length > 1) {
    log(`Warning: multiple matches for ${filename}, using first`)
  }
  return matches[0]
}

function runPdftoppm(pdfPath, outPrefix, pageCount) {
  // ~150 DPI for typical comic page width near 1200px
  const args = ['-png', '-r', '150', '-f', '1', '-l', String(pageCount), pdfPath, outPrefix]
  const result = spawnSync('pdftoppm', args, { stdio: 'inherit' })
  if (result.status !== 0) {
    fail(`pdftoppm failed for ${pdfPath}`)
  }
}

function convertPngToWebp(pngPath, webpPath) {
  const args = [
    '-q',
    String(WEBP_QUALITY),
    '-resize',
    String(TARGET_WIDTH),
    '0',
    pngPath,
    '-o',
    webpPath,
  ]
  const result = spawnSync('cwebp', args, { stdio: 'inherit' })
  if (result.status !== 0) {
    fail(`cwebp failed for ${pngPath}`)
  }
}

function trimComicWebp(dir) {
  const trimScript = join(ROOT, 'scripts', 'trim-comic-webp.py')
  if (!existsSync(trimScript)) return
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.webp'))
    .map((f) => join(dir, f))
  if (!files.length) return
  log(`  Trimming margins: ${basename(dir)}/`)
  const result = spawnSync('python3', [trimScript, ...files], { stdio: 'inherit' })
  if (result.status !== 0) {
    fail(`trim-comic-webp failed for ${dir}`)
  }
}

function normalizeCoverWebp(coverPath, coverRatio = '2/3') {
  const script = join(ROOT, 'scripts', 'normalize-comic-cover.py')
  if (!existsSync(script)) return
  log(`  Normalizing cover: ${basename(dirname(coverPath))}/cover.webp (${coverRatio})`)
  const result = spawnSync('python3', [script, coverPath, coverRatio], { stdio: 'inherit' })
  if (result.status !== 0) {
    fail(`normalize-comic-cover failed for ${coverPath}`)
  }
}

function collectPdftoppmPages(tmpSeriesDir) {
  const files = readdirSync(tmpSeriesDir)
    .filter((f) => /^page-\d+\.png$/.test(f))
    .sort((a, b) => {
      const na = Number(a.match(/(\d+)/)[1])
      const nb = Number(b.match(/(\d+)/)[1])
      return na - nb
    })

  return files.map((f) => join(tmpSeriesDir, f))
}

function ensureTools() {
  const pdftoppm = findCommand('pdftoppm')
  const cwebp = findCommand('cwebp')

  if (!pdftoppm || !cwebp) {
    console.error(MACOS_INSTALL_HINT)
    if (!pdftoppm) console.error('Missing: pdftoppm (poppler)')
    if (!cwebp) console.error('Missing: cwebp (webp)')
    process.exit(1)
  }

  log(`Using pdftoppm: ${pdftoppm}`)
  log(`Using cwebp: ${cwebp}`)
}

function validateSeriesOutput(seriesId, pageCount) {
  const dir = join(PUBLIC_COMICS, seriesId)
  const required = ['cover.webp', ...Array.from({ length: pageCount }, (_, i) => `page-${String(i + 1).padStart(2, '0')}.webp`)]
  const missing = required.filter((name) => !existsSync(join(dir, name)))
  if (missing.length) {
    fail(`${seriesId}: missing files: ${missing.join(', ')}`)
  }
  return required.map((name) => join(dir, name))
}

function reportSeries(seriesId, pdfPath, files) {
  const sizes = files.map((f) => statSync(f).size)
  const total = sizes.reduce((a, b) => a + b, 0)
  const max = Math.max(...sizes)
  const maxFile = basename(files[sizes.indexOf(max)])
  const heavy = files.filter((f) => statSync(f).size > 400 * 1024)

  log(`\n${seriesId}:`)
  log(`  PDF: ${pdfPath}`)
  log(`  Output: ${join(PUBLIC_COMICS, seriesId)}/`)
  log(`  Files: ${files.length} (${formatBytes(total)} total)`)
  log(`  Largest: ${maxFile} (${formatBytes(max)})`)

  if (heavy.length) {
    log(`  Warning: ${heavy.length} file(s) over 400 KB:`)
    for (const f of heavy) {
      log(`    - ${basename(f)}: ${formatBytes(statSync(f).size)}`)
    }
  } else {
    log('  All pages within 400 KB')
  }

  return { seriesId, fileCount: files.length, totalBytes: total, maxBytes: max, heavyCount: heavy.length }
}

function main() {
  const onlySeriesId = process.argv[2] ?? null
  const seriesToProcess = onlySeriesId
    ? SERIES.filter((s) => s.id === onlySeriesId)
    : SERIES

  if (onlySeriesId && seriesToProcess.length === 0) {
    fail(`Unknown series id: ${onlySeriesId}`)
  }

  log('[prepare-comics] GameNight Host — comic asset preparation\n')
  if (onlySeriesId) {
    log(`Single series mode: ${onlySeriesId}\n`)
  }

  ensureTools()

  const needsZipSource = seriesToProcess.some((s) => !['series-5', 'series-6', 'series-7', 'series-8', 'series-9', 'series-10'].includes(s.id))
  if (needsZipSource) {
    unzipArchive()
  }

  mkdirSync(PUBLIC_COMICS, { recursive: true })
  rmSync(TEMP_DIR, { recursive: true, force: true })
  mkdirSync(TEMP_DIR, { recursive: true })

  const foundPdfs = []
  const reports = []

  for (const { id, pdf, pages = DEFAULT_PAGE_COUNT, coverRatio = '2/3' } of seriesToProcess) {
    const pdfPath = findPdfByName(pdf)
    if (!pdfPath) {
      fail(`PDF not found: ${pdf}`)
    }
    foundPdfs.push({ id, pdf, pdfPath })
    log(`\nProcessing ${id} ← ${pdf}`)

    const outDir = join(PUBLIC_COMICS, id)
    const tmpSeriesDir = join(TEMP_DIR, id)
    rmSync(outDir, { recursive: true, force: true })
    rmSync(tmpSeriesDir, { recursive: true, force: true })
    mkdirSync(outDir, { recursive: true })
    mkdirSync(tmpSeriesDir, { recursive: true })

    const ppmPrefix = join(tmpSeriesDir, 'page')
    runPdftoppm(pdfPath, ppmPrefix, pages)

    const pngPages = collectPdftoppmPages(tmpSeriesDir)
    if (pngPages.length !== pages) {
      fail(`${id}: expected ${pages} PNG pages, got ${pngPages.length}`)
    }

    for (let i = 0; i < pages; i++) {
      const pageNum = String(i + 1).padStart(2, '0')
      const webpPath = join(outDir, `page-${pageNum}.webp`)
      convertPngToWebp(pngPages[i], webpPath)
    }

    trimComicWebp(outDir)

    const coverPath = join(outDir, 'cover.webp')
    copyFileSync(join(outDir, 'page-01.webp'), coverPath)
    normalizeCoverWebp(coverPath, coverRatio)

    const files = validateSeriesOutput(id, pages)
    reports.push(reportSeries(id, pdfPath, files))
  }

  rmSync(TEMP_DIR, { recursive: true, force: true })

  const grandTotal = reports.reduce((sum, r) => sum + r.totalBytes, 0)
  const totalFiles = reports.reduce((sum, r) => sum + r.fileCount, 0)

  log('\n=== Summary ===')
  log(`PDFs processed: ${foundPdfs.length}`)
  for (const { id, pdf, pdfPath } of foundPdfs) {
    log(`  ✓ ${id}: ${pdf}`)
    log(`    source: ${pdfPath}`)
  }
  log(`WebP files created: ${totalFiles} (${formatBytes(grandTotal)} total)`)
  log(`Output root: ${PUBLIC_COMICS}/`)

  const allHeavy = reports.filter((r) => r.heavyCount > 0)
  if (allHeavy.length) {
    log(`\nNote: ${allHeavy.length} series have pages heavier than 400 KB — consider lowering quality or width.`)
  } else {
    log('\nAll series within per-page size target (≤400 KB).')
  }

  log('\nDone.')
}

main()
