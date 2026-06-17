function comicsRoot(): string {
  const base = import.meta.env.BASE_URL
  const normalized = base.endsWith('/') ? base : `${base}/`
  return `${normalized}comics`
}

/** Public URL for series cover (served from public/comics/, not bundled). */
export function getComicCoverUrl(seriesId: string): string {
  return `${comicsRoot()}/${seriesId}/cover.webp`
}

/** Public URL for a comic page — for reader step; not used in catalog list. */
export function getComicPageUrl(seriesId: string, page: number): string {
  const padded = String(Math.max(1, Math.floor(page))).padStart(2, '0')
  return `${comicsRoot()}/${seriesId}/page-${padded}.webp`
}
