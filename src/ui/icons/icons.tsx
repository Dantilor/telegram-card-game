import type { ReactNode } from 'react'

const SVG_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  stroke: 'currentColor',
}

/** Path with accent color via CSS .icon-accent */
const accent = { className: 'icon-accent' } as const

export const ICONS: Record<string, () => ReactNode> = {
  card: () => (
    <svg {...SVG_PROPS}><path d="M3 6h18v12H3z" /><path d="M3 10h18M8 6v12" /></svg>
  ),
  moon: () => (
    <svg {...SVG_PROPS}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
  ),
  message: () => (
    <svg {...SVG_PROPS}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
  ),
  target: () => (
    <svg {...SVG_PROPS}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" {...accent} /><circle cx="12" cy="12" r="2" /></svg>
  ),
  devil: () => (
    <svg {...SVG_PROPS}><path d="M12 2a4 4 0 0 0-4 4v2a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4z" /><path d="M8 14s-2 4 4 4 4-4 4-4" /><path d="M9 10h.01M15 10h.01" strokeWidth={2} /><path d="M12 18v2M10 20h4" /></svg>
  ),
  question: () => (
    <svg {...SVG_PROPS}><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" /></svg>
  ),
  dice: () => (
    <svg {...SVG_PROPS}><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1" fill="currentColor" /><circle cx="16" cy="8" r="1" fill="currentColor" /><circle cx="8" cy="16" r="1" fill="currentColor" /><circle cx="16" cy="16" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /></svg>
  ),
  party: () => (
    <svg {...SVG_PROPS}><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M6.34 17.66L4.93 19.07M19.07 4.93l-1.41 1.41" /><path d="M8 14l4-4 4 4-4 4-4-4z" {...accent} /></svg>
  ),
  heart: () => (
    <svg {...SVG_PROPS}><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" {...accent} /></svg>
  ),
  sparkle: () => (
    <svg {...SVG_PROPS}><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" {...accent} /><path d="M5 19l1.2 2.4 2.4.4-1.8 1.6.4 2.4L5 24l-1.8-1.6.4-2.4-1.8-1.6 2.4-.4L5 19z" /><path d="M19 5l.6 1.2 1.2.2-.9.8.2 1.2L19 9l-.9-.8.2-1.2-1.2-.2L19 5z" /></svg>
  ),
  fire: () => (
    <svg {...SVG_PROPS}><path d="M12 22L8 14L12 8L16 14Z" /><path d="M12 18L10 14L12 11L14 14Z" {...accent} /></svg>
  ),
  adult: () => (
    <svg {...SVG_PROPS}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
  ),
  box: () => (
    <svg {...SVG_PROPS}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" /></svg>
  ),
  cinema: () => (
    <svg {...SVG_PROPS}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M10 4v16M14 4v16M2 10h20M2 14h20" /></svg>
  ),
  brain: () => (
    <svg {...SVG_PROPS}><path d="M12 5a3 3 0 1 0-3 3v1a3 3 0 0 0 6 0V8a3 3 0 0 0-3-3z" /><path d="M9 12a4 4 0 0 0 6 0M9 16h6M8 20h8" /></svg>
  ),
  money: () => (
    <svg {...SVG_PROPS}><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" {...accent} /></svg>
  ),
  scroll: () => (
    <svg {...SVG_PROPS}><path d="M8 3h8v4H8zM6 7h12v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7z" /></svg>
  ),
  flask: () => (
    <svg {...SVG_PROPS}><path d="M9 3h6v4l4 8a2 2 0 0 1-1.8 2.8H6.8A2 2 0 0 1 5 15l4-8V3z" /><path d="M9 7h6" /></svg>
  ),
  sport: () => (
    <svg {...SVG_PROPS}><circle cx="12" cy="12" r="10" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /><path d="M2 12h20" /></svg>
  ),
  globe: () => (
    <svg {...SVG_PROPS}><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
  ),
  briefcase: () => (
    <svg {...SVG_PROPS}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
  ),
  crown: () => (
    <svg {...SVG_PROPS}><path d="M2 17l4-7 4 4 4-8 4 8 4-4 4 7H2z" /><path d="M4 17h16" {...accent} /></svg>
  ),
  user: () => (
    <svg {...SVG_PROPS}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
  ),
  pill: () => (
    <svg {...SVG_PROPS}><path d="M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12z" /><path d="M10 14l4-4" {...accent} /></svg>
  ),
  star: () => (
    <svg {...SVG_PROPS}><polygon points="12 2 14.9 9.1 22 9.6 16.5 14.2 18.2 21 12 17.6 5.8 21 7.5 14.2 2 9.6 9.1 9.1 12 2" /><polygon points="12 6 13.5 10.5 18 10.8 14.2 13.5 15.2 18 12 15.5 8.8 18 9.8 13.5 6 10.8 10.5 10.5 12 6" {...accent} /></svg>
  ),
  smirk: () => (
    <svg {...SVG_PROPS}><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><path d="M8 9h.01M16 10h.01" strokeWidth={2} /></svg>
  ),
  mask: () => (
    <svg {...SVG_PROPS}><path d="M4 8V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2" /><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /><path d="M12 4v16M2 12h4M18 12h4" /></svg>
  ),
  awkward: () => (
    <svg {...SVG_PROPS}><circle cx="12" cy="12" r="10" /><path d="M8 15h8M9 9c.5 1 1.5 1.5 3 1.5s2.5-.5 3-1.5" /></svg>
  ),
  emotions: () => (
    <svg {...SVG_PROPS}><circle cx="12" cy="12" r="10" /><path d="M8 14h8M9 9h.01M15 9h.01" /></svg>
  ),
  laugh: () => (
    <svg {...SVG_PROPS}><circle cx="12" cy="12" r="10" /><path d="M8 8c1 0 1.5.5 1.5 1.5S9 11 8 11M16 8c-1 0-1.5.5-1.5 1.5S15 11 16 11M8 14c2 1 4 1 6 0" /></svg>
  ),
  hit: () => (
    <svg {...SVG_PROPS}><path d="M12 22L8 14L12 8L16 14ZM12 18L10 14L12 11L14 14Z" {...accent} /></svg>
  ),
  check: () => (
    <svg {...SVG_PROPS}><path d="M20 6L9 17l-5-5" /></svg>
  ),
  home: () => (
    <svg {...SVG_PROPS}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></svg>
  ),
  diamond: () => (
    <svg {...SVG_PROPS}><path d="M12 2L2 8l10 14 10-14L12 2z" /><path d="M2 8h20M12 2v20" {...accent} /></svg>
  ),
  lightning: () => (
    <svg {...SVG_PROPS}><path d="M13 2L7 12h4l-2 10 10-12h-4l2-8z" /></svg>
  ),
  book: () => (
    <svg {...SVG_PROPS}><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" /><path d="M4 8h16M4 12h16" /></svg>
  ),
  shield: () => (
    <svg {...SVG_PROPS}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" {...accent} /></svg>
  ),
  flower: () => (
    <svg {...SVG_PROPS}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" /><path d="M12 5v2M12 17v2M5 12h2M17 12h2" {...accent} /></svg>
  ),
  eye: () => (
    <svg {...SVG_PROPS}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" {...accent} /></svg>
  ),
  candle: () => (
    <svg {...SVG_PROPS}><path d="M12 2v3M12 19v3M10 5h4v10H10V5z" /><path d="M11 5c0-1 1-2 2-2s2 1 2 2" {...accent} /></svg>
  ),
  gift: () => (
    <svg {...SVG_PROPS}><path d="M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8M4 12h16M12 22V12" /><path d="M12 12H2v-2c0-2 2-4 5-4 2 0 5 2 5 4v2zM12 12h10v-2c0-2-2-4-5-4-2 0-5 2-5 4v2z" {...accent} /></svg>
  ),
  sun: () => (
    <svg {...SVG_PROPS}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M6.34 17.66L4.93 19.07M19.07 4.93l-1.41 1.41M2 12h2M20 12h2" /><path d="M12 6v2M12 16v2M7.76 7.76l1.42 1.42M14.82 14.82l1.42 1.42M6 12h2M16 12h2M7.76 16.24l-1.42 1.42M14.82 9.18l-1.42 1.42" {...accent} /></svg>
  ),
  house: () => (
    <svg {...SVG_PROPS}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></svg>
  ),
  scale: () => (
    <svg {...SVG_PROPS}><path d="M12 3v18M3 9h18M8 9l4-6 4 6M5 15h14M8 15l4 6 4-6" /></svg>
  ),
  butterfly: () => (
    <svg {...SVG_PROPS}><path d="M12 4c-2 0-4 2-4 4s2 4 4 4 4-2 4-4-2-4-4-4z" /><path d="M12 12v8M9 20l3-4 3 4" /><path d="M4 8c0 4 2 6 8 6s8-2 8-6M4 8c2 2 4 2 8 2s6 0 8-2M4 8c1-2 3-2 8-2s7 0 8 2" {...accent} /></svg>
  ),
  lightbulb: () => (
    <svg {...SVG_PROPS}><path d="M9 18h6M10 22h4M12 3a5 5 0 0 0-5 5c0 2 1 3 2 4v2h6v-2c1-1 2-2 2-4a5 5 0 0 0-5-5z" /><path d="M12 8v2M10 10h4" {...accent} /></svg>
  ),
  ban: () => (
    <svg {...SVG_PROPS}><circle cx="12" cy="12" r="10" /><path d="M4.93 4.93l14.14 14.14" {...accent} /></svg>
  ),
  'arrow-left': () => (
    <svg {...SVG_PROPS}><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
  ),
}

export type IconName = keyof typeof ICONS
