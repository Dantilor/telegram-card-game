import type { CSSProperties } from 'react'
import './ResponsiveArtwork.css'

export type ArtworkFile = {
  src: string
  width: number
  height: number
}

export type ResponsiveArtworkSource = {
  desktop: ArtworkFile
  mobile: ArtworkFile
}

type Props = {
  artwork: ResponsiveArtworkSource
  alt?: string
  priority?: boolean
  className?: string
}

/** picture with exact ASSET_MAP ratios; switches at 640px. */
export default function ResponsiveArtwork({
  artwork,
  alt = '',
  priority = false,
  className,
}: Props) {
  const style = {
    '--gnh-aspect-desktop': `${artwork.desktop.width} / ${artwork.desktop.height}`,
    '--gnh-aspect-mobile': `${artwork.mobile.width} / ${artwork.mobile.height}`,
  } as CSSProperties

  return (
    <picture className={`gnh-responsive-art${className ? ` ${className}` : ''}`} style={style}>
      <source
        media="(max-width: 640px)"
        srcSet={artwork.mobile.src}
        width={artwork.mobile.width}
        height={artwork.mobile.height}
      />
      <img
        src={artwork.desktop.src}
        width={artwork.desktop.width}
        height={artwork.desktop.height}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        {...(priority ? { fetchPriority: 'high' as const } : {})}
      />
    </picture>
  )
}
