/**
 * Предзагрузка изображений через new Image() для кэширования в браузере.
 * Вызывать при старте приложения до первого рендера. Использует батчи:
 * сначала самые критичные (hero, первые карточки), затем остальные.
 */
export function preloadImages(urls: string[]): void {
  if (!urls.length) return
  const batch1 = urls.slice(0, 8) // hero + все карточки игр первого экрана
  const batch2 = urls.slice(8)
  batch1.forEach((url) => {
    const img = new Image()
    img.src = url
  })
  if (batch2.length > 0) {
    const loadRest = () => {
      batch2.forEach((url) => {
        const img = new Image()
        img.src = url
      })
    }
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(loadRest, { timeout: 200 })
    } else {
      setTimeout(loadRest, 50)
    }
  }
}
