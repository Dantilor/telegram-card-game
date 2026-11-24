import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { loadWebSeoManifest, resolveWebHtml, type WebSeoManifest } from './seoStatic.js'

const manifest: WebSeoManifest = {
  version: 1,
  origin: 'https://play.gamenighthost.ru',
  pages: {
    '/': 'index.html',
    '/games': '_seo/pages/games.html',
    '/discover/mafiya-onlajn': '_seo/pages/discover/mafiya-onlajn.html',
  },
  appShell: '_seo/app.html',
  notFound: '_seo/404.html',
  appRoutePrefixes: ['/profile', '/mafia', '/mafia-shadows', '/premium', '/recover', '/login', '/link-web'],
}

test('public SEO pages get their prerendered file with 200 and no noindex', () => {
  assert.deepEqual(resolveWebHtml(manifest, '/'), { kind: 'file', file: 'index.html', status: 200, noindex: false })
  assert.deepEqual(resolveWebHtml(manifest, '/discover/mafiya-onlajn', '?utm_source=x'), {
    kind: 'file',
    file: '_seo/pages/discover/mafiya-onlajn.html',
    status: 200,
    noindex: false,
  })
})

test('app routes keep the SPA shell (200) but are noindex', () => {
  for (const p of ['/profile', '/mafia/night', '/mafia-shadows', '/premium', '/recover', '/link-web']) {
    assert.deepEqual(resolveWebHtml(manifest, p), { kind: 'file', file: '_seo/app.html', status: 200, noindex: true })
  }
})

test('unknown paths return the 404 page with HTTP 404', () => {
  for (const p of ['/nope', '/discover/unknown', '/mafiaxyz', '/games/extra', '/_seo/manifest.json']) {
    assert.deepEqual(resolveWebHtml(manifest, p), { kind: 'file', file: '_seo/404.html', status: 404, noindex: true })
  }
})

test('trailing slash and /index.html redirect to the canonical path, keeping the query', () => {
  assert.deepEqual(resolveWebHtml(manifest, '/games/', '?a=1'), { kind: 'redirect', location: '/games?a=1' })
  assert.deepEqual(resolveWebHtml(manifest, '/index.html'), { kind: 'redirect', location: '/' })
  assert.equal(resolveWebHtml(manifest, '//evil.example/').kind, 'file')
})

test('without a manifest every path keeps the legacy SPA fallback', () => {
  assert.deepEqual(resolveWebHtml(null, '/anything'), { kind: 'file', file: 'index.html', status: 200, noindex: false })
})

test('loadWebSeoManifest rejects manifests that reference missing files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gnh-seo-'))
  try {
    fs.mkdirSync(path.join(dir, '_seo'), { recursive: true })
    fs.writeFileSync(path.join(dir, '_seo', 'manifest.json'), JSON.stringify(manifest))
    assert.equal(loadWebSeoManifest(dir), null)
    for (const file of [...Object.values(manifest.pages), manifest.appShell, manifest.notFound]) {
      fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
      fs.writeFileSync(path.join(dir, file), '<html></html>')
    }
    assert.deepEqual(loadWebSeoManifest(dir), manifest)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})