import { Link } from 'react-router-dom'
import { isWebShell } from '../../config/shell'
import { useLegal } from '../../legal/LegalProvider'
import { haptic } from '../../utils/telegram'
import { GNH_OPERATOR } from '../../lib/gnhOperator'
import './WebSiteFooter.css'

/** Public SEO landings (src/seo/seoContent.ts); kept inline so the footer does not pull the SEO chunk. */
const DISCOVER_LINKS = [
  { to: '/discover/igry-dlya-kompanii', label: 'Игры для компании' },
  { to: '/discover/mafiya-onlajn', label: 'Мафия онлайн' },
  { to: '/discover/igry-dlya-dvoih', label: 'Игры для двоих' },
  { to: '/discover/igry-dlya-vecherinki', label: 'Игры для вечеринки' },
  { to: '/discover/associacii-alias', label: 'Ассоциации' },
] as const

export default function WebSiteFooter() {
  const legal = useLegal()
  if (!isWebShell()) return null
  const year = new Date().getFullYear()

  return (
    <footer className="web-site-footer" aria-label="Подвал сайта">
      <div className="web-site-footer__inner">
        <div className="web-site-footer__brand">
          <p className="web-site-footer__name">GameNight Host</p>
          <p className="web-site-footer__tagline">{GNH_OPERATOR.tagline}</p>
          <nav className="web-site-footer__help" aria-label="Помощь">
            <Link to="/profile#faq" onClick={() => haptic('light')}>
              Частые вопросы
            </Link>
            <a href={GNH_OPERATOR.supportUrl} target="_blank" rel="noopener noreferrer" onClick={() => haptic('light')}>
              Связаться с поддержкой
            </a>
          </nav>
          <nav className="web-site-footer__help" aria-label="Подборки игр">
            {DISCOVER_LINKS.map((link) => (
              <Link key={link.to} to={link.to} onClick={() => haptic('light')}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <nav className="web-site-footer__nav" aria-label="Юридические ссылки">
          <button type="button" onClick={() => { haptic('light'); legal.openDocument('privacy') }}>
            Политика конфиденциальности
          </button>
          <button type="button" onClick={() => { haptic('light'); legal.openDocument('agreement') }}>
            Пользовательское соглашение
          </button>
          <button type="button" onClick={() => { haptic('light'); legal.openDocument('offer') }}>
            Публичная оферта Premium
          </button>
        </nav>
        <div className="web-site-footer__legal">
          <p>{GNH_OPERATOR.legalName}</p>
          <p>
            ИНН {GNH_OPERATOR.inn} · ОГРНИП {GNH_OPERATOR.ogrnip}
          </p>
          <p className="web-site-footer__copy">© {year} GameNight Host</p>
        </div>
      </div>
    </footer>
  )
}
