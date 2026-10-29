import { sledAsset } from './sled-assets'

const MOBILE_EVIDENCE_WIDTH = 720

function filenameFromPath(src: string) {
  return src.slice(src.lastIndexOf('/') + 1)
}

export function mobileEvidenceSource(src: string) {
  return sledAsset(`/evidence/mobile/${filenameFromPath(src)}`)
}

export function evidenceSrcSet(src: string, originalWidth = 1280) {
  const full = sledAsset(src.startsWith('/evidence/') ? src : `/evidence/${filenameFromPath(src)}`)
  return `${mobileEvidenceSource(src)} ${MOBILE_EVIDENCE_WIDTH}w, ${full} ${originalWidth}w`
}

export function evidenceSizes(compact = false) {
  return compact
    ? '(max-width: 760px) calc(100vw - 62px), (max-width: 1100px) 58vw, 620px'
    : '(max-width: 760px) calc(100vw - 32px), (max-width: 1100px) 68vw, 980px'
}

export function preferredEvidenceSource(src: string, compactViewport: boolean) {
  return compactViewport ? mobileEvidenceSource(src) : sledAsset(src)
}

export const cityMapSources = {
  fallback: sledAsset('/game/city-map-neon.webp'),
  compact: sledAsset('/game/city-map-neon-760.webp'),
  desktop: sledAsset('/game/city-map-neon-1200.webp'),
  srcSet: [
    `${sledAsset('/game/city-map-neon-760.webp')} 760w`,
    `${sledAsset('/game/city-map-neon-1200.webp')} 1200w`,
    `${sledAsset('/game/city-map-neon.webp')} 1400w`,
  ].join(', '),
  sizes: '(max-width: 760px) 100vw, (max-width: 1100px) 72vw, 1050px',
} as const

export const hostikSources = {
  fallback: sledAsset('/game/hostik-guide.webp'),
  srcSet: `${sledAsset('/game/hostik-guide-360.webp')} 360w, ${sledAsset('/game/hostik-guide.webp')} 720w`,
} as const
