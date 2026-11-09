const preloadedUrls = new Set<string>()

/**
 * Предзагрузка изображений через new Image() для кэширования в браузере.
 * Не загружает повторно URL из кэша preloadedUrls.
 */
function loadOne(url: string): void {
  if (!url || preloadedUrls.has(url)) return
  preloadedUrls.add(url)
  const img = new Image()
  img.decoding = 'async'
  img.src = url
}

/**
 * Предзагрузка изображений батчами, чтобы не открывать десятки соединений сразу.
 * Повторный вызов с теми же URL не создаёт повторных загрузок (кэш Set).
 */
export function preloadImages(urls: string[], options?: { batchSize?: number; gapMs?: number }): void {
  if (!urls.length) return
  const batchSize = Math.max(1, options?.batchSize ?? 4)
  const gapMs = options?.gapMs ?? 120
  const unique = urls.filter((url) => url && !preloadedUrls.has(url))
  if (!unique.length) return

  const runBatch = (start: number) => {
    const slice = unique.slice(start, start + batchSize)
    slice.forEach(loadOne)
    const next = start + batchSize
    if (next >= unique.length) return
    const scheduleNext = () => runBatch(next)
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(scheduleNext, { timeout: gapMs + 400 })
    } else {
      setTimeout(scheduleNext, gapMs)
    }
  }

  runBatch(0)
}
