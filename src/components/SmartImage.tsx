import { useState } from 'react'
import './SmartImage.css'

type Props = {
  src: string
  alt: string
  className?: string
  priority?: boolean
  webpSrc?: string
  /** Для стабильного лейаута: 4/3 по умолчанию для карточек */
  aspectRatio?: string
  objectFit?: 'cover' | 'contain'
}

export default function SmartImage({ src, alt, className, priority, webpSrc, aspectRatio = '4 / 3', objectFit = 'cover' }: Props) {
  const [loaded, setLoaded] = useState(false)

  const handleLoad = () => {
    setLoaded(true)
  }

  const imgEl = (
    <img
      src={src}
      alt={alt}
      className={`smart-image__img ${loaded ? 'smart-image__img--loaded' : ''}`}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      {...(priority && { fetchPriority: 'high' as const })}
      onLoad={(e) => {
        const img = e.currentTarget
        if (img.decode) {
          img.decode().then(handleLoad).catch(handleLoad)
        } else {
          handleLoad()
        }
      }}
      style={{ objectFit }}
    />
  )

  return (
    <div
      className={`smart-image ${className ?? ''}`.trim()}
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      {!loaded && <div className="smart-image__skeleton" aria-hidden />}
      {webpSrc ? (
        <picture className="smart-image__picture">
          <source type="image/webp" srcSet={webpSrc} />
          {imgEl}
        </picture>
      ) : (
        imgEl
      )}
    </div>
  )
}
