import type { Block, StoredDocument } from './types.js'

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function linkify(escaped: string): string {
  return escaped.replace(/https?:\/\/[^\s<>"']+/g, (url) => {
    return `<a href="${url}" rel="noopener noreferrer">${url}</a>`
  })
}

function renderBlock(block: Block): string {
  if (block.type === 'heading') {
    const level = Math.min(6, Math.max(1, block.level))
    return `<h${level}>${linkify(escapeHtml(block.text))}</h${level}>`
  }
  if (block.type === 'paragraph') {
    return `<p>${linkify(escapeHtml(block.text))}</p>`
  }
  const rows = block.rows
    .map((row, index) => {
      const tag = index === 0 ? 'th' : 'td'
      const cells = row.map((cell) => `<${tag}>${linkify(escapeHtml(cell))}</${tag}>`).join('')
      return `<tr>${cells}</tr>`
    })
    .join('')
  return `<table>${rows}</table>`
}

export function renderDocumentHtml(document: StoredDocument): string {
  const body =
    document.blocks.length > 0
      ? document.blocks.map(renderBlock).join('\n')
      : `<pre>${escapeHtml(document.bodyMarkdown)}</pre>`
  const title = escapeHtml(document.title)
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
  <title>${title}</title>
  <style>
    body { margin: 0; color: #172033; background: #fff; font: 18px/1.5 system-ui, sans-serif; }
    main { max-width: 42rem; margin: 0 auto; padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(32px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); }
    h1 { font-size: 1.7rem; line-height: 1.25; }
    h2 { font-size: 1.25rem; line-height: 1.3; margin-top: 1.4em; }
    a { color: #0b57d0; overflow-wrap: anywhere; }
    p, li, td, th { overflow-wrap: anywhere; }
    table { width: 100%; border-collapse: collapse; display: block; overflow-x: auto; }
    td, th { border: 1px solid #d5dbe3; padding: 8px; text-align: left; vertical-align: top; }
    .meta { color: #526072; font-size: 0.95rem; }
  </style>
</head>
<body>
  <main>
    <p class="meta">Версия ${escapeHtml(document.version)} · SHA-256 ${escapeHtml(document.sha256)}</p>
    ${body}
  </main>
</body>
</html>`
}

export function renderUnavailableHtml(): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
  <title>Документ недоступен</title>
  <style>
    body { margin: 0; font: 18px/1.5 system-ui, sans-serif; color: #172033; }
    main { max-width: 42rem; margin: 0 auto; padding: max(16px, env(safe-area-inset-top)) 16px 32px; }
  </style>
</head>
<body>
  <main>
    <h1>Документ недоступен</h1>
    <p>Утверждённый текст этого документа сейчас недоступен. Эта страница не заменяет документ и не означает принятие условий.</p>
  </main>
</body>
</html>`
}
