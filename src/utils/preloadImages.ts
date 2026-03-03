const preloadedUrls = new Set<string>()

/**
 * Предзагрузка изображений через new Image() для кэширования в браузере.
 * Не загружает повторно URL из кэша preloadedUrls.
 */
function loadOne(url: string): void {
  if (!url || preloadedUrls.has(url)) return
  preloadedUrls.add(url)
  const img = new Image()
  img.src = url
}

/**
 * Предзагрузка изображений через new Image() для кэширования в браузере.
 * Вызывать при старте приложения до первого рендера. Использует батчи:
 * сначала самые критичные (hero, первые карточки), затем остальные.
 * Повторный вызов с теми же URL не создаёт повторных загрузок (кэш Set).
 */
export function preloadImages(urls: string[]): void {
  if (!urls.length) return
  const batch1 = urls.slice(0, 8)
  const batch2 = urls.slice(8)
  batch1.forEach(loadOne)
  if (batch2.length > 0) {
    const loadRest = () => batch2.forEach(loadOne)
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(loadRest, { timeout: 200 })
    } else {
      setTimeout(loadRest, 50)
    }
  }
}
