import type { CSSProperties, ReactNode } from 'react';

type ArtworkFile = { src: string; width: number; height: number };
export type ResponsiveArtworkSource = { desktop: ArtworkFile; mobile: ArtworkFile };

/* Get exact paths and dimensions from ASSET_MAP.json. Resolve src through the app's existing Vite/base asset strategy. */
export function ResponsiveArtwork({ artwork, alt, priority = false }: {
  artwork: ResponsiveArtworkSource;
  alt: string;
  priority?: boolean;
}) {
  const style = {
    '--gnh-aspect-desktop': `${artwork.desktop.width} / ${artwork.desktop.height}`,
    '--gnh-aspect-mobile': `${artwork.mobile.width} / ${artwork.mobile.height}`,
  } as CSSProperties;
  return (
    <picture className="gnh-responsive-art" style={style}>
      <source media="(max-width: 640px)" srcSet={artwork.mobile.src}
        width={artwork.mobile.width} height={artwork.mobile.height} />
      <img src={artwork.desktop.src} width={artwork.desktop.width} height={artwork.desktop.height}
        alt={alt} loading={priority ? 'eager' : 'lazy'} decoding="async" />
    </picture>
  );
}

/* Place this visual wrapper outside the Home max-width container. Children come from the real app. */
export function HeroArtwork({ artwork, children }: { artwork: ResponsiveArtworkSource; children: ReactNode }) {
  return <section className="gnh-asset-hero">
    <ResponsiveArtwork artwork={artwork} alt="" priority />
    <div className="gnh-asset-hero__copy">{children}</div>
  </section>;
}

/* Keep the current Link/button wrapper, badges and real game handlers around this artwork. */
export function WideGameArtwork({ artwork, title, metadata }: {
  artwork: ResponsiveArtworkSource; title: string; metadata: ReactNode;
}) {
  return <div className="gnh-asset-card">
    <ResponsiveArtwork artwork={artwork} alt="" />
    <div className="gnh-asset-card__copy"><h2>{title}</h2><p>{metadata}</p></div>
  </div>;
}
