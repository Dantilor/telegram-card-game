import { DEFAULT_OG_IMAGE, DEFAULT_OG_IMAGE_ALT, HOME_PAGE, SITE_NAME, findSeoPage } from './seoContent'
import {
  absoluteUrl,
  buildJsonLd,
  INDEXABLE_ROBOTS,
  isAppRoutePath,
  NOINDEX_ROBOTS,
} from './seoRender'

type MetaKey =
  | 'description'
  | 'robots'
  | 'og:title'
  | 'og:description'
  | 'og:url'
  | 'og:image'
  | 'og:image:alt'
  | 'twitter:title'
  | 'twitter:description'
  | 'twitter:image'
  | 'twitter:image:alt'

function setMeta(key: MetaKey, content: string | null): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[data-gnh-seo="${key}"]`)
  if (content === null) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(key.startsWith('og:') ? 'property' : 'name', key)
    el.dataset.gnhSeo = key
    document.head.appendChild(el)
  }
  el.content = content
}

function setCanonical(href: string | null): void {
  let el = document.head.querySelector<HTMLLinkElement>('link[data-gnh-seo="canonical"]')
  if (href === null) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('link')
    el.rel = 'canonical'
    el.dataset.gnhSeo = 'canonical'
    document.head.appendChild(el)
  }
  el.href = href
}

function setJsonLd(data: Record<string, unknown>[] | null): void {
  let el = document.head.querySelector<HTMLScriptElement>('script[data-gnh-seo="jsonld"]')
  if (!data?.length) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('script')
    el.type = 'application/ld+json'
    el.dataset.gnhSeo = 'jsonld'
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data.length === 1 ? data[0] : data)
}

/** Keep <head> in sync with the WEB route after client-side navigation. */
export function applyWebSeoHead(pathname: string): void {
  const page = findSeoPage(pathname)
  const title = page?.title ?? (isAppRoutePath(pathname) ? SITE_NAME : `Страница не найдена — ${SITE_NAME}`)
  const description = page?.description ?? HOME_PAGE.description
  const image = absoluteUrl(page?.ogImage ?? DEFAULT_OG_IMAGE)
  const imageAlt = page?.ogImageAlt ?? DEFAULT_OG_IMAGE_ALT
  const url = page ? absoluteUrl(page.path) : null

  document.title = title
  setMeta('description', description)
  setMeta('robots', page ? INDEXABLE_ROBOTS : NOINDEX_ROBOTS)
  setCanonical(url)
  setMeta('og:title', title)
  setMeta('og:description', description)
  setMeta('og:url', url)
  setMeta('og:image', image)
  setMeta('og:image:alt', imageAlt)
  setMeta('twitter:title', title)
  setMeta('twitter:description', description)
  setMeta('twitter:image', image)
  setMeta('twitter:image:alt', imageAlt)
  setJsonLd(page ? buildJsonLd(page) : null)
}