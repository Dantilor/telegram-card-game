import './WebMetrikaConsentBanner.css'
import { METRIKA_CONSENT_PARAGRAPHS, METRIKA_CONSENT_TITLE, METRIKA_CONSENT_VERSION } from './metrikaConsentText'

/** Collapsible full consent text, available before the visitor chooses. */
export default function MetrikaConsentFullText({
  className = '',
  defaultOpen = false,
}: {
  className?: string
  /** Banner should show the text expanded before the choice. */
  defaultOpen?: boolean
}) {
  return (
    <details className={`web-metrika-consent-text ${className}`.trim()} open={defaultOpen || undefined}>
      <summary className="web-metrika-consent-text__summary">Полный текст согласия</summary>
      <div className="web-metrika-consent-text__body" role="document" aria-label={METRIKA_CONSENT_TITLE}>
        <p className="web-metrika-consent-text__title">
          {METRIKA_CONSENT_TITLE} (редакция {METRIKA_CONSENT_VERSION})
        </p>
        {METRIKA_CONSENT_PARAGRAPHS.map((text) => (
          <p key={text.slice(0, 40)} className="web-metrika-consent-text__p">
            {text}
          </p>
        ))}
      </div>
    </details>
  )
}