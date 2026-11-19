const fs = require('fs')
const path = require('path')

const tsx = `import neon from '../assets/home-backgrounds/home-bg-neon.webp'
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
    <div className={\`gnh-theme-background gnh-theme-background--\${key}\`} aria-hidden="true">
      {(['top', 'bottom'] as const).map((edge) => (
        <picture key={edge}>
          <source media="(max-width: 640px)" srcSet={background.mobile} type="image/webp" />
          <img
            className={\`gnh-theme-background__art gnh-theme-background__art--\${edge}\`}
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
`

const css = `/* App-wide decorative theme atmosphere (cubes top / stones bottom). */
.gnh-theme-background {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  user-select: none;
  background-color: var(--gnh-theme-background-base, var(--app-page-bg-color, #060a1b));
}

.gnh-theme-background--neon {
  --gnh-theme-background-base: #060a1b;
}

.gnh-theme-background--light {
  --gnh-theme-background-base: #f6f4ff;
}

.gnh-theme-background--sunset {
  --gnh-theme-background-base: #fff5f0;
}

.gnh-theme-background--calm {
  --gnh-theme-background-base: #f5f7f6;
}

.gnh-theme-background__art {
  position: absolute;
  left: 50%;
  display: block;
  width: min(100%, 56rem);
  max-width: none;
  height: auto;
  transform: translateX(-50%);
  pointer-events: none;
  user-select: none;
}

.gnh-theme-background__art--top {
  top: 0;
  -webkit-mask-image: linear-gradient(to bottom, #000 0%, #000 35%, transparent 72%);
  mask-image: linear-gradient(to bottom, #000 0%, #000 35%, transparent 72%);
}

.gnh-theme-background__art--bottom {
  bottom: 0;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, transparent 58%, #000 85%, #000 100%);
  mask-image: linear-gradient(to bottom, transparent 0%, transparent 58%, #000 85%, #000 100%);
}

/* Keep page chrome above the fixed decor; overlays keep their own stacking. */
.app > :not(.gnh-theme-background) {
  position: relative;
  z-index: 1;
}

html,
body,
#root {
  background-color: var(--app-page-bg-color, #060a1b);
}

.app,
.app.app--web {
  background-color: transparent;
  background-image: none;
}
`

fs.mkdirSync('src/components', { recursive: true })
fs.writeFileSync('src/components/ThemeBackground.tsx', tsx, 'utf8')
fs.writeFileSync('src/components/ThemeBackground.css', css, 'utf8')
console.log('wrote ThemeBackground')
