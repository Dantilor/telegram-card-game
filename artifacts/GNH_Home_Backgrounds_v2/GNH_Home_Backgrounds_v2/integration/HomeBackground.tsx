// Integration example: adapt asset paths and pass the existing app theme.
// Import this component's CSS once from the home route.
import neon from '../assets/home-bg-neon.webp';
import neonMobile from '../assets/home-bg-neon-mobile.webp';
import light from '../assets/home-bg-light.webp';
import lightMobile from '../assets/home-bg-light-mobile.webp';
import sunset from '../assets/home-bg-sunset.webp';
import sunsetMobile from '../assets/home-bg-sunset-mobile.webp';
import calm from '../assets/home-bg-calm.webp';
import calmMobile from '../assets/home-bg-calm-mobile.webp';
import './HomeBackground.css';

export type HomeBackgroundTheme = 'neon' | 'light' | 'sunset' | 'calm';

const backgrounds = {
  neon: { desktop: neon, mobile: neonMobile },
  light: { desktop: light, mobile: lightMobile },
  sunset: { desktop: sunset, mobile: sunsetMobile },
  calm: { desktop: calm, mobile: calmMobile },
} satisfies Record<HomeBackgroundTheme, { desktop: string; mobile: string }>;

export function HomeBackground({ theme }: { theme: HomeBackgroundTheme }) {
  const background = backgrounds[theme];

  return (
    <div className={`gnh-home-background gnh-home-background--${theme}`} aria-hidden="true">
      {(['top', 'bottom'] as const).map((edge) => (
        <picture key={edge}>
          <source media="(max-width: 640px)" srcSet={background.mobile} type="image/webp" />
          <img
            className={`gnh-home-background__art gnh-home-background__art--${edge}`}
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
  );
}
