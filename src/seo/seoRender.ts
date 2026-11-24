/**
 * DOM-free HTML/text renderers for the WEB SEO layer.
 * Used at build time (prerendered HTML, robots.txt, sitemap.xml, server manifest)
 * and at runtime by the React /discover pages, so crawlers and users get identical markup.
 */
import { GNH_OPERATOR } from '../lib/gnhOperator'
import {
  DEFAULT_OG_IMAGE,
  DEFAULT_OG_IMAGE_ALT,
  HOME_PAGE,
  LANDING_PAGES,
  SEO_GAMES,
  SEO_GAME_ACCESS_LABEL,
  SEO_PAGES,
  SITE_NAME,
  SITE_ORIGIN,
  type SeoPage,
  type SeoSection,
} from './seoContent'

/** First path segments of the React app (App.tsx). Served as the noindex app shell. */
export const APP_ROUTE_PREFIXES = [
  '/comics',
  '/card',
  '/game',
  '/decks',
  '/mode',
  '/favorites',
  '/alias',
  '/activity',
  '/mafia',
  '/sabotage',
  '/quiz',
  '/truth-dare',
  '/who-is-who',
  '/phrase-translator',
  '/freebie-trash',
  '/russia-travel',
  '/sled',
  '/mafia-shadows',
  '/doubles',
  '/infected',
  '/play',
  '/profile',
  '/premium',
  '/wheel',
  '/login',
  '/recover',
  '/email/confirm',
  '/link-web',
  '/legal',
] as const

/**
 * Crawl-blocked paths: API and one-time token flows only.
 * Account/game screens stay crawlable so robots can see their noindex.
 */
export const ROBOTS_DISALLOW = ['/api/', '/email/confirm', '/link-web', '/decks/custom/'] as const

export const SEO_PRERENDER_DIR = '_seo'
export const SEO_MANIFEST_FILE = `${SEO_PRERENDER_DIR}/manifest.json`

export type SeoManifest = {
  version: 1
  origin: string
  pages: Record<string, string>
  appShell: string
  notFound: string
  appRoutePrefixes: string[]
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function absoluteUrl(path: string): string {
  return `${SITE_ORIGIN}${path === '/' ? '/' : path}`
}

export function seoCoverUrl(gameId: string): string {
  return `/seo/covers/${gameId}.webp`
}

export function prerenderFileForPath(path: string): string {
  if (path === '/') return 'index.html'
  return `${SEO_PRERENDER_DIR}/pages${path}.html`
}

export function isAppRoutePath(pathname: string): boolean {
  return APP_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

function renderSection(section: SeoSection): string {
  const parts = [`<section class="gnh-seo__section"><h2>${escapeHtml(section.heading)}</h2>`]
  for (const p of section.paragraphs ?? []) parts.push(`<p>${escapeHtml(p)}</p>`)
  if (section.bullets?.length) {
    parts.push(`<ul>${section.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`)
  }
  if (section.steps?.length) {
    parts.push(`<ol>${section.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>`)
  }
  parts.push('</section>')
  return parts.join('')
}

/**
 * Covers only on /discover pages: there React renders the same markup.
 * On / and /games the prerender is replaced by the app, so extra image downloads would only compete with JS.
 */
function renderGameCard(entry: { id: string; note?: string }, cover: 'eager' | 'lazy' | 'none'): string {
  const game = SEO_GAMES[entry.id]
  if (!game) throw new Error(`Unknown SEO game id: ${entry.id}`)
  const meta = [game.players, game.format].filter(Boolean).map((m) => escapeHtml(m as string)).join(' · ')
  const badge = `<span class="gnh-seo__badge gnh-seo__badge--${game.access}">${escapeHtml(SEO_GAME_ACCESS_LABEL[game.access])}</span>`
  return [
    `<li class="gnh-seo__game${cover === 'none' ? ' gnh-seo__game--text' : ''}">`,
    cover === 'none'
      ? badge
      : [
          `<a class="gnh-seo__game-link" href="${game.route}">`,
          `<img src="${seoCoverUrl(game.id)}" alt="${escapeHtml(`${game.title} — обложка игры`)}" width="640" height="427"`,
          cover === 'eager' ? '' : ' loading="lazy"',
          ` decoding="async" />`,
          badge,
          `</a>`,
        ].join(''),
    `<div class="gnh-seo__game-body">`,
    `<h3><a href="${game.route}">${escapeHtml(game.title)}</a></h3>`,
    meta ? `<p class="gnh-seo__game-meta">${meta}</p>` : '',
    `<p>${escapeHtml(game.summary)}</p>`,
    entry.note ? `<p class="gnh-seo__game-note">${escapeHtml(entry.note)}</p>` : '',
    `</div>`,
    `</li>`,
  ].join('')
}

function renderHeader(): string {
  return [
    '<header class="gnh-seo__header">',
    `<a class="gnh-seo__logo" href="/" aria-label="${SITE_NAME} — главная">GameNight <span>Host</span></a>`,
    '<nav class="gnh-seo__nav" aria-label="Основная навигация">',
    '<a href="/games">Каталог игр</a>',
    '<a href="/discover/mafiya-onlajn">Мафия онлайн</a>',
    '<a class="gnh-seo__nav-cta" href="/games">Играть</a>',
    '</nav>',
    '</header>',
  ].join('')
}

function renderBreadcrumbs(page: SeoPage): string {
  if (page.kind === 'home') return ''
  return [
    '<nav class="gnh-seo__crumbs" aria-label="Хлебные крошки"><ol>',
    '<li><a href="/">Главная</a></li>',
    `<li aria-current="page">${escapeHtml(page.label)}</li>`,
    '</ol></nav>',
  ].join('')
}

function renderRelated(page: SeoPage): string {
  const links = LANDING_PAGES.filter((p) => p.path !== page.path)
  return [
    '<section class="gnh-seo__section gnh-seo__related" aria-labelledby="gnh-seo-related">',
    '<h2 id="gnh-seo-related">Подборки игр</h2>',
    '<ul>',
    ...links.map((p) => `<li><a href="${p.path}">${escapeHtml(p.label)}</a></li>`),
    page.kind !== 'catalog' ? '<li><a href="/games">Все игры</a></li>' : '',
    '</ul>',
    '</section>',
  ].join('')
}

function renderFooter(): string {
  return [
    '<footer class="gnh-seo__footer">',
    `<p class="gnh-seo__footer-name">${SITE_NAME}</p>`,
    `<p>${escapeHtml(GNH_OPERATOR.tagline)}</p>`,
    '<nav aria-label="Документы">',
    '<a href="/legal/documents/privacy">Политика конфиденциальности</a>',
    '<a href="/legal/documents/agreement">Пользовательское соглашение</a>',
    '<a href="/legal/documents/offer">Публичная оферта Premium</a>',
    `<a href="${GNH_OPERATOR.supportUrl}" rel="noopener noreferrer">Поддержка</a>`,
    '</nav>',
    `<p class="gnh-seo__footer-legal">${escapeHtml(GNH_OPERATOR.legalName)} · ИНН ${GNH_OPERATOR.inn} · ОГРНИП ${GNH_OPERATOR.ogrnip}</p>`,
    '</footer>',
  ].join('')
}

/** Main page markup. Identical for the prerendered HTML and the React /discover route. */
export function renderSeoPageBody(page: SeoPage): string {
  const games = page.games ?? []
  return [
    `<div class="gnh-seo gnh-seo--${page.kind}" data-gnh-seo-page="${escapeHtml(page.path)}">`,
    renderHeader(),
    '<main class="gnh-seo__main">',
    renderBreadcrumbs(page),
    '<section class="gnh-seo__hero">',
    `<h1>${escapeHtml(page.h1)}</h1>`,
    `<p class="gnh-seo__lead">${escapeHtml(page.lead)}</p>`,
    `<a class="gnh-seo__cta" href="${page.cta.href}">${escapeHtml(page.cta.label)}</a>`,
    '</section>',
    games.length
      ? [
          '<section class="gnh-seo__section" aria-labelledby="gnh-seo-games">',
          `<h2 id="gnh-seo-games">${escapeHtml(page.gamesHeading ?? 'Игры')}</h2>`,
          `<ul class="gnh-seo__games">${games.map((g, i) => renderGameCard(g, page.kind !== 'landing' ? 'none' : i < 2 ? 'eager' : 'lazy')).join('')}</ul>`,
          '</section>',
        ].join('')
      : '',
    ...(page.sections ?? []).map(renderSection),
    renderRelated(page),
    '</main>',
    renderFooter(),
    '</div>',
  ].join('')
}

export function renderNotFoundBody(): string {
  return [
    '<div class="gnh-seo gnh-seo--not-found">',
    renderHeader(),
    '<main class="gnh-seo__main">',
    '<section class="gnh-seo__hero">',
    '<h1>Страница не найдена</h1>',
    '<p class="gnh-seo__lead">Такой страницы нет или она была перемещена. Загляните в каталог — там все игры GameNight Host.</p>',
    '<a class="gnh-seo__cta" href="/games">Открыть каталог игр</a>',
    '</section>',
    '</main>',
    renderFooter(),
    '</div>',
  ].join('')
}

export function buildJsonLd(page: SeoPage): Record<string, unknown>[] {
  if (page.kind === 'home') {
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_NAME,
        url: absoluteUrl('/'),
        inLanguage: 'ru-RU',
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: SITE_NAME,
        url: absoluteUrl('/'),
        logo: absoluteUrl('/brand/pwa/icon-512.png'),
      },
    ]
  }
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Главная', item: absoluteUrl('/') },
        { '@type': 'ListItem', position: 2, name: page.label, item: absoluteUrl(page.path) },
      ],
    },
  ]
}

function jsonLdScript(data: Record<string, unknown>[]): string {
  const json = JSON.stringify(data.length === 1 ? data[0] : data).replace(/</g, '\\u003c')
  return `<script type="application/ld+json" data-gnh-seo="jsonld">${json}</script>`
}

type HeadInput = {
  title: string
  description: string
  canonicalPath?: string
  robots: string
  ogImage: string
  ogImageAlt: string
  jsonLd?: Record<string, unknown>[]
}

export function buildHeadTags(input: HeadInput): string {
  const t = escapeHtml(input.title)
  const d = escapeHtml(input.description)
  const image = absoluteUrl(input.ogImage)
  const tags = [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" data-gnh-seo="description" />`,
    `<meta name="robots" content="${input.robots}" data-gnh-seo="robots" />`,
    input.canonicalPath
      ? `<link rel="canonical" href="${absoluteUrl(input.canonicalPath)}" data-gnh-seo="canonical" />`
      : '',
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:locale" content="ru_RU" />`,
    `<meta property="og:title" content="${t}" data-gnh-seo="og:title" />`,
    `<meta property="og:description" content="${d}" data-gnh-seo="og:description" />`,
    input.canonicalPath
      ? `<meta property="og:url" content="${absoluteUrl(input.canonicalPath)}" data-gnh-seo="og:url" />`
      : '',
    `<meta property="og:image" content="${image}" data-gnh-seo="og:image" />`,
    `<meta property="og:image:type" content="image/jpeg" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${escapeHtml(input.ogImageAlt)}" data-gnh-seo="og:image:alt" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${t}" data-gnh-seo="twitter:title" />`,
    `<meta name="twitter:description" content="${d}" data-gnh-seo="twitter:description" />`,
    `<meta name="twitter:image" content="${image}" data-gnh-seo="twitter:image" />`,
    `<meta name="twitter:image:alt" content="${escapeHtml(input.ogImageAlt)}" data-gnh-seo="twitter:image:alt" />`,
    input.jsonLd?.length ? jsonLdScript(input.jsonLd) : '',
  ]
  return tags.filter(Boolean).map((tag) => `    ${tag}`).join('\n')
}

export const INDEXABLE_ROBOTS = 'index, follow, max-image-preview:large'
export const NOINDEX_ROBOTS = 'noindex, follow'

export function pageHead(page: SeoPage): string {
  return buildHeadTags({
    title: page.title,
    description: page.description,
    canonicalPath: page.path,
    robots: INDEXABLE_ROBOTS,
    ogImage: page.ogImage,
    ogImageAlt: page.ogImageAlt,
    jsonLd: buildJsonLd(page),
  })
}

export function appShellHead(): string {
  return buildHeadTags({
    title: SITE_NAME,
    description: HOME_PAGE.description,
    robots: NOINDEX_ROBOTS,
    ogImage: DEFAULT_OG_IMAGE,
    ogImageAlt: DEFAULT_OG_IMAGE_ALT,
  })
}

export function notFoundHead(): string {
  return buildHeadTags({
    title: `Страница не найдена — ${SITE_NAME}`,
    description: HOME_PAGE.description,
    robots: 'noindex, follow',
    ogImage: DEFAULT_OG_IMAGE,
    ogImageAlt: DEFAULT_OG_IMAGE_ALT,
  })
}

/** Inject head tags, optional inline CSS and #root content into Vite's built index.html. */
export function injectIntoShell(shellHtml: string, opts: { head: string; css?: string; body?: string }): string {
  if (!/<title>[^<]*<\/title>/.test(shellHtml)) throw new Error('SEO prerender: <title> not found in shell')
  if (!shellHtml.includes('<div id="root"></div>')) throw new Error('SEO prerender: #root not found in shell')
  const css = opts.css ? `\n    <style data-gnh-seo="css">${opts.css}</style>` : ''
  return shellHtml
    .replace(/\s*<title>[^<]*<\/title>/, `\n${opts.head}${css}`)
    .replace('<div id="root"></div>', `<div id="root">${opts.body ?? ''}</div>`)
}

export function buildRobotsTxt(): string {
  return [
    'User-agent: *',
    ...ROBOTS_DISALLOW.map((p) => `Disallow: ${p}`),
    'Allow: /',
    '',
    `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
    '',
  ].join('\n')
}

export function buildSitemapXml(): string {
  const urls = SEO_PAGES.map(
    (page) =>
      `  <url>\n    <loc>${absoluteUrl(page.path)}</loc>\n    <lastmod>${page.updated}</lastmod>\n  </url>`,
  )
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}

export function buildSeoManifest(): SeoManifest {
  const pages: Record<string, string> = {}
  for (const page of SEO_PAGES) pages[page.path] = prerenderFileForPath(page.path)
  return {
    version: 1,
    origin: SITE_ORIGIN,
    pages,
    appShell: `${SEO_PRERENDER_DIR}/app.html`,
    notFound: `${SEO_PRERENDER_DIR}/404.html`,
    appRoutePrefixes: [...APP_ROUTE_PREFIXES],
  }
}