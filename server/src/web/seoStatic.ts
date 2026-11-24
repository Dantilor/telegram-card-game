import fs from 'node:fs'
import path from 'node:path'

/** Written by the WEB build (vite.config.ts -> dist-web/_seo/manifest.json). */
export type WebSeoManifest = {
  version: 1
  origin: string
  pages: Record<string, string>
  appShell: string
  notFound: string
  appRoutePrefixes: string[]
}

export type WebHtmlResolution =
  | { kind: 'redirect'; location: string }
  | { kind: 'file'; file: string; status: 200 | 404; noindex: boolean }

export const WEB_SEO_MANIFEST_PATH = '_seo/manifest.json'

export function loadWebSeoManifest(webRoot: string): WebSeoManifest | null {
  try {
    const raw = fs.readFileSync(path.join(webRoot, WEB_SEO_MANIFEST_PATH), 'utf8')
    const parsed = JSON.parse(raw) as Partial<WebSeoManifest>
    if (
      parsed.version !== 1 ||
      !parsed.pages ||
      typeof parsed.appShell !== 'string' ||
      typeof parsed.notFound !== 'string' ||
      !Array.isArray(parsed.appRoutePrefixes)
    ) {
      return null
    }
    const files = [...Object.values(parsed.pages), parsed.appShell, parsed.notFound]
    if (!files.every((file) => fs.existsSync(path.join(webRoot, file)))) return null
    return parsed as WebSeoManifest
  } catch {
    return null
  }
}

function isAppRoute(manifest: WebSeoManifest, pathname: string): boolean {
  return manifest.appRoutePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

/**
 * Pick the HTML for a WEB navigation request.
 * Without a manifest (older build) every path keeps the legacy SPA fallback.
 */
export function resolveWebHtml(
  manifest: WebSeoManifest | null,
  pathname: string,
  search = '',
): WebHtmlResolution {
  if (!manifest) return { kind: 'file', file: 'index.html', status: 200, noindex: false }

  if (pathname === '/index.html') return { kind: 'redirect', location: `/${search}` }
  if (pathname === '/_seo' || pathname.startsWith('/_seo/')) {
    return { kind: 'file', file: manifest.notFound, status: 404, noindex: true }
  }

  const page = manifest.pages[pathname]
  if (page) return { kind: 'file', file: page, status: 200, noindex: false }

  const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/, '') || '/' : pathname
  if (trimmed !== pathname && manifest.pages[trimmed]) {
    return { kind: 'redirect', location: `${trimmed}${search}` }
  }

  if (isAppRoute(manifest, pathname)) {
    return { kind: 'file', file: manifest.appShell, status: 200, noindex: true }
  }
  return { kind: 'file', file: manifest.notFound, status: 404, noindex: true }
}