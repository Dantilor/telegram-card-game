import { useTheme } from '../hooks/useTheme'
import iconPremiumDiamond from '../assets/icons/gnh-light-pro/premium-diamond-pro.png'
import iconLightPremiumDiamond from '../assets/icons/gnh-calm-pro/premium-diamond-pro.png'
import iconSunsetPremiumDiamond from '../assets/icons/gnh-sunset-pro/premium-diamond-pro.png'
import iconCalmPremiumDiamond from '../assets/icons/gnh/premium-diamond.png'
import './HomePremiumBanner.css'

const GEMS_BY_THEME = {
  'neon-dark': iconPremiumDiamond,
  'neon-light': iconLightPremiumDiamond,
  sunset: iconSunsetPremiumDiamond,
  'minimal-calm': iconCalmPremiumDiamond,
} as const

type HomePremiumBannerProps = {
  loading: boolean
  plansPriceLabel: string
  onOpen: () => void
}

function HomePremiumBanner({ loading, plansPriceLabel, onOpen }: HomePremiumBannerProps) {
  const [theme] = useTheme()
  const gem = GEMS_BY_THEME[theme]

  return (
    <section className="home-premium-banner" aria-label="Premium">
      <button type="button" className="home-premium-banner__card" onClick={onOpen}>
        <span className="home-premium-banner__gem-wrap" aria-hidden>
          <img src={gem} alt="" className="home-premium-banner__gem" decoding="async" />
        </span>
        <div className="home-premium-banner__body">
          <div className="home-premium-banner__title-row">
            <span className="home-premium-banner__title">Premium</span>
            <span className="home-premium-banner__badge">PRO</span>
          </div>
          <p className="home-premium-banner__sub">
            Открывает все игры и режимы • без автосписаний
          </p>
        </div>
        <div className="home-premium-banner__aside">
          <span className="home-premium-banner__price">
            {loading ? 'Проверяем…' : plansPriceLabel}
          </span>
          <span className="home-play-btn home-play-btn--picks" aria-hidden>
            <span className="home-play-btn__triangle" />
          </span>
        </div>
      </button>
    </section>
  )
}

export default HomePremiumBanner
