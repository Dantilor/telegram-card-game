/**
 * One-off generator for committed SEO images (WEB only):
 *  - public/seo/covers/<gameId>.webp  — 640×427 thumbnails of real catalog covers
 *  - public/og/<name>.jpg             — 1200×630 Open Graph cards built from brand art
 *
 * Run: node scripts/seo/generate-seo-images.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const src = (file) => path.join(root, 'src', 'assets', 'optimized', file)

const COVERS = {
  card: 'catalog-card-game.webp',
  mafia: 'catalog-mafia.webp',
  alias: 'catalog-alias.webp',
  activity: 'catalog-activity.webp',
  sabotage: 'catalog-sabotage.webp',
  quiz: 'catalog-quiz.webp',
  'truth-dare': 'catalog-truth-dare.webp',
  'who-is-who': 'catalog-who-is-who.webp',
  'phrase-translator': 'catalog-phrase-translator.webp',
  'freebie-trash': 'catalog-freebie-trash.webp',
  'russia-travel': 'catalog-russia-travel.webp',
  sled: 'catalog-sled.webp',
  'mafia-shadows': 'catalog-mafia-shadows.webp',
  doubles: 'catalog-doubles.webp',
  infected: 'catalog-infected.webp',
}

const OG = [
  {
    name: 'gnh-default',
    source: 'portal-mobile.webp',
    title: ['Онлайн-игры', 'для компании и друзей'],
    subtitle: 'Мафия, Ассоциации, Саботаж и другие игры',
  },
  {
    name: 'discover-igry-dlya-kompanii',
    source: 'catalog-sabotage.webp',
    title: ['Игры для компании'],
    subtitle: 'Мафия, детективы, Ассоциации и викторина',
  },
  {
    name: 'discover-mafiya-onlajn',
    source: 'catalog-mafia-shadows.webp',
    title: ['Мафия онлайн'],
    subtitle: 'Мафия Lite и «Мафия: Тени города»',
  },
  {
    name: 'discover-igry-dlya-dvoih',
    source: 'catalog-card-game.webp',
    title: ['Игры для двоих'],
    subtitle: 'Вопросы для пары, викторина, правда или действие',
  },
  {
    name: 'discover-igry-dlya-vecherinki',
    source: 'catalog-activity.webp',
    title: ['Игры для вечеринки'],
    subtitle: 'Активитус, Ассоциации и смешные карточки',
  },
  {
    name: 'discover-associacii-alias',
    source: 'catalog-alias.webp',
    title: ['Ассоциации'],
    subtitle: 'Объясни слово команде — в стиле Alias',
  },
]

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function ogOverlay({ title, subtitle }) {
  const titleSize = title.length > 1 ? 66 : 78
  const titleTop = title.length > 1 ? 262 : 300
  const lines = title
    .map(
      (line, i) =>
        `<text x="72" y="${titleTop + i * (titleSize + 10)}" font-size="${titleSize}" font-weight="700" fill="url(#t)">${escapeXml(line)}</text>`,
    )
    .join('')
  const subY = titleTop + (title.length - 1) * (titleSize + 10) + 64
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <linearGradient id="shade" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#160a2b" stop-opacity="0.92"/>
      <stop offset="0.5" stop-color="#1d0f36" stop-opacity="0.72"/>
      <stop offset="0.85" stop-color="#1d0f36" stop-opacity="0.05"/>
    </linearGradient>
    <linearGradient id="t" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#e6c8ff"/>
      <stop offset="0.6" stop-color="#f5ddff"/>
      <stop offset="1" stop-color="#fbefd2"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#shade)"/>
  <g font-family="Segoe UI, Arial, sans-serif">
    <rect x="72" y="96" width="268" height="52" rx="26" fill="#ffffff" fill-opacity="0.14" stroke="#ffffff" stroke-opacity="0.35"/>
    <text x="206" y="131" font-size="26" font-weight="700" fill="#ffffff" text-anchor="middle">GameNight Host</text>
    ${lines}
    <text x="72" y="${subY}" font-size="32" font-weight="400" fill="#f3e9ff">${escapeXml(subtitle)}</text>
    <text x="72" y="560" font-size="26" font-weight="600" fill="#ffffff" fill-opacity="0.82">play.gamenighthost.ru</text>
  </g>
</svg>`)
}

async function main() {
  const coversDir = path.join(root, 'public', 'seo', 'covers')
  const ogDir = path.join(root, 'public', 'og')
  fs.mkdirSync(coversDir, { recursive: true })
  fs.mkdirSync(ogDir, { recursive: true })

  for (const [id, file] of Object.entries(COVERS)) {
    const out = path.join(coversDir, `${id}.webp`)
    await sharp(src(file)).resize(640, 427, { fit: 'cover' }).webp({ quality: 72 }).toFile(out)
    console.log('cover', path.relative(root, out), fs.statSync(out).size)
  }

  for (const og of OG) {
    const out = path.join(ogDir, `${og.name}.jpg`)
    const base = await sharp(src(og.source)).resize(1200, 630, { fit: 'cover', position: 'centre' }).toBuffer()
    await sharp(base)
      .composite([{ input: ogOverlay(og) }])
      .jpeg({ quality: 84, progressive: true, mozjpeg: true })
      .toFile(out)
    console.log('og', path.relative(root, out), fs.statSync(out).size)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})