import { haptic } from '../../utils/telegram'
import './HomeCommunitySection.css'

const TELEGRAM_CHANNEL = 'https://t.me/GameNightHostBot_news'
const INSTAGRAM = 'https://www.instagram.com/gamenighthostbot/'
const TELEGRAM_MINI_APP = 'https://t.me/GameNightHostBot'

function TelegramGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M21.8 4.3 3.7 11.3c-1.2.5-1.2 1.1-.2 1.4l4.6 1.4 1.8 5.4c.2.7.4.9 1 .9.6 0 .9-.3 1.2-.6l2.8-2.7 4.6 3.4c.8.5 1.4.2 1.6-.8L22.9 5.5c.3-1.1-.4-1.6-1.1-1.2ZM9.4 14.2l-.3 3.9 1.6-2.1 6.7-6.1-8 4.3Z"
      />
    </svg>
  )
}

function InstagramGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 7.2A4.8 4.8 0 1 0 12 16.8 4.8 4.8 0 0 0 12 7.2Zm0 7.9a3.1 3.1 0 1 1 0-6.2 3.1 3.1 0 0 1 0 6.2Zm6.1-8.2a1.12 1.12 0 1 1-2.24 0 1.12 1.12 0 0 1 2.24 0ZM12 3.5c-2.3 0-2.6 0-3.5.05-1.7.08-3.2 1-3.9 2.5-.35.8-.5 1.7-.52 3.5 0 .9 0 1.2.05 3.5.08 1.7 1 3.2 2.5 3.9.8.35 1.7.5 3.5.52.9 0 1.2 0 3.5-.05 1.7-.08 3.2-1 3.9-2.5.35-.8.5-1.7.52-3.5 0-.9 0-1.2-.05-3.5-.08-1.7-1-3.2-2.5-3.9-.8-.35-1.7-.5-3.5-.52-.9 0-1.2 0-3.5.05Zm0 1.6c2.26 0 2.53 0 3.42.05 1.3.06 2.02.28 2.5.46.62.24 1.06.53 1.53 1 .46.46.75.9 1 1.52.18.48.4 1.2.46 2.5.04.89.05 1.16.05 3.42s0 2.53-.05 3.42c-.06 1.3-.28 2.02-.46 2.5-.24.62-.53 1.06-1 1.53-.46.46-.9.75-1.52 1-.48.18-1.2.4-2.5.46-.89.04-1.16.05-3.42.05s-2.53 0-3.42-.05c-1.3-.06-2.02-.28-2.5-.46a4.1 4.1 0 0 1-1.53-1 4.1 4.1 0 0 1-1-1.52c-.18-.48-.4-1.2-.46-2.5C5.54 14.53 5.5 14.26 5.5 12s0-2.53.05-3.42c.06-1.3.28-2.02.46-2.5.24-.62.53-1.06 1-1.53.46-.46.9-.75 1.52-1 .48-.18 1.2-.4 2.5-.46.89-.04 1.16-.05 3.42-.05Z"
      />
    </svg>
  )
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M8.2 5.4c-.9-.5-2-.1-2 .9v11.4c0 1 .1 1.4 2 .9l10-5.7c.9-.5.9-1.4 0-1.9l-10-5.6Z"
      />
    </svg>
  )
}

/** WEB-only community strip on the home portal. External links only. */
export default function HomeCommunitySection() {
  const onOpen = () => haptic('light')

  return (
    <section className="gnh-community wrap" aria-labelledby="gnh-community-title">
      <div className="gnh-community__glow" aria-hidden="true" />
      <header className="gnh-community__intro">
        <p className="gnh-community__eyebrow">GAME NIGHT COMMUNITY</p>
        <h2 id="gnh-community-title">Игра продолжается за пределами экрана</h2>
        <p className="gnh-community__lead">
          Новости, новые игры, закулисье и атмосфера GameNight Host — присоединяйся к сообществу и
          будь в курсе первым.
        </p>
      </header>

      <div className="gnh-community__grid">
        <article className="gnh-community-card gnh-community-card--telegram">
          <div className="gnh-community-card__badge" aria-hidden="true">
            <TelegramGlyph />
          </div>
          <div className="gnh-community-card__body">
            <h3>Наш Telegram-канал</h3>
            <p>Узнавай о новых играх, обновлениях и событиях первым.</p>
            <a
              className="gnh-community-card__cta"
              href={TELEGRAM_CHANNEL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onOpen}
            >
              Перейти в канал
            </a>
          </div>
        </article>

        <article className="gnh-community-card gnh-community-card--instagram">
          <div className="gnh-community-card__badge" aria-hidden="true">
            <InstagramGlyph />
          </div>
          <div className="gnh-community-card__body">
            <h3>Мы в Instagram</h3>
            <p>Загляни за кулисы GameNight Host — вдохновение, атмосфера и интересные моменты.</p>
            <a
              className="gnh-community-card__cta"
              href={INSTAGRAM}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onOpen}
            >
              Открыть Instagram
            </a>
          </div>
        </article>
      </div>

      <a
        className="gnh-community__miniapp"
        href={TELEGRAM_MINI_APP}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onOpen}
      >
        <span className="gnh-community__miniapp-icon" aria-hidden="true">
          <PlayGlyph />
        </span>
        <span className="gnh-community__miniapp-copy">
          <strong>Играть через Telegram</strong>
          <span>Открыть GameNight Host в Mini App</span>
        </span>
        <span className="gnh-community__miniapp-arrow" aria-hidden="true">
          →
        </span>
      </a>
    </section>
  )
}
