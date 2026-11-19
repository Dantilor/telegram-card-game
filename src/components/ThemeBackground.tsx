import neon from '../assets/home-backgrounds/home-bg-neon.webp'
import neonMobile from '../assets/home-backgrounds/home-bg-neon-mobile.webp'
import light from '../assets/home-backgrounds/home-bg-light.webp'
import lightMobile from '../assets/home-backgrounds/home-bg-light-mobile.webp'
import sunset from '../assets/home-backgrounds/home-bg-sunset.webp'
import sunsetMobile from '../assets/home-backgrounds/home-bg-sunset-mobile.webp'
import calm from '../assets/home-backgrounds/home-bg-calm.webp'
import calmMobile from '../assets/home-backgrounds/home-bg-calm-mobile.webp'
import type { ThemeId } from '../hooks/useTheme'
import './ThemeBackground.css'

/** Visual keys used by the background asset pack */
export type ThemeBackgroundKey = 'neon' | 'light' | 'sunset' | 'calm'

const APP_THEME_TO_BG: Record<ThemeId, ThemeBackgroundKey> = {
  'neon-dark': 'neon',
  'neon-light': 'light',
  sunset: 'sunset',
  'minimal-calm': 'calm',
}

const backgrounds = {
  neon: { desktop: neon, mobile: neonMobile },
  light: { desktop: light, mobile: lightMobile },
  sunset: { desktop: sunset, mobile: sunsetMobile },
  calm: { desktop: calm, mobile: calmMobile },
} satisfies Record<ThemeBackgroundKey, { desktop: string; mobile: string }>

export function toThemeBackgroundKey(theme: ThemeId): ThemeBackgroundKey {
  return APP_THEME_TO_BG[theme] ?? 'light'
}

export function ThemeBackground({ theme }: { theme: ThemeId }) {
  const key = toThemeBackgroundKey(theme)
  const background = backgrounds[key]

  return (
    <div className={`gnh-theme-background gnh-theme-background--${key}`} aria-hidden="true">
      {(['top', 'bottom'] as const).map((edge) => (
        <picture key={edge}>
          <source media="(max-width: 640px)" srcSet={background.mobile} type="image/webp" />
          <img
            className={`gnh-theme-background__art gnh-theme-background__art--${edge}`}
            src={background.desktop}
            alt=""
            width={1182}
            height={1330}
            decoding="async"
            loading="eager"
            fetchPriority="low"
            draggable={false}
          />
        </picture>
      ))}
    </div>
  )
}
