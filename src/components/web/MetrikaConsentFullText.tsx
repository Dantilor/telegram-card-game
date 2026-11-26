import './WebMetrikaConsentBanner.css'
import { METRIKA_CONSENT_PARAGRAPHS, METRIKA_CONSENT_TITLE, METRIKA_CONSENT_VERSION } from './metrikaConsentText'

/** Full consent text, available before the visitor chooses. Wording lives in metrikaConsentText.ts. */
export default function MetrikaConsentFullText({
  className = '',
  defaultOpen = false,
  hideSummary = false,
}: {
  className?: string
  defaultOpen?: boolean
  /** Banner: the text is revealed by its own «Подробнее» control, so no nested summary. */
  hideSummary?: boolean
}) {
  const body = (
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
  )
  if (hideSummary) {
    return <div className={`web-metrika-consent-text web-metrika-consent-text--flat ${className}`.trim()}>{body}</div>
  }
  return (
    <details className={`web-metrika-consent-text ${className}`.trim()} open={defaultOpen || undefined}>
      <summary className="web-metrika-consent-text__summary">Полный текст согласия</summary>
      {body}
    </details>
  )
}