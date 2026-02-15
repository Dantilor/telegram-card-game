/**
 * Предзагрузка изображений через new Image() для кэширования в браузере.
 * Вызывать при mount главного экрана / App для критичных картинок первого экрана.
 */
export function preloadImages(urls: string[]): void {
  urls.forEach((url) => {
    const img = new Image()
    img.src = url
  })
}
