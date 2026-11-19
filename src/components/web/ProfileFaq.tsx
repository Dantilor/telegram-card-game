import { useEffect, useId, useState } from 'react'
import { GNH_OPERATOR } from '../../lib/gnhOperator'
import { haptic } from '../../utils/telegram'
import './ProfileFaq.css'

type FaqItem = { q: string; a: string }

const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'Пропал Premium. Что делать?',
    a: 'Откройте профиль и нажмите «Обновить статус Premium».\n\nЕсли покупали на сайте, восстановите доступ через email, указанный при покупке.\n\nЕсли Premium был в Telegram, проверьте привязку аккаунтов.\n\nЕсли доступ не восстановился, обратитесь в поддержку.',
  },
  {
    q: 'Есть ли автоматические списания?',
    a: 'Нет. Premium оплачивается один раз за выбранный срок.\n\nАвтоматического продления нет. По окончании срока можно самостоятельно оформить новый доступ.',
  },
  {
    q: 'Нужен ли Premium каждому игроку?',
    a: 'Нет. В играх с ведущим Premium достаточно только ведущему.\n\nОстальные игроки могут подключаться по коду комнаты бесплатно.',
  },
  {
    q: 'Как связать сайт и Telegram?',
    a: 'Откройте профиль сайта, нажмите «Связать с Telegram» и подтвердите привязку в Mini App.\n\nПосле этого доступ Premium будет общим для связанных аккаунтов.',
  },
  {
    q: 'Как восстановить покупки?',
    a: 'Если вы оплатили Premium на сайте, используйте раздел восстановления доступа по email, указанному при покупке.\n\nЕсли покупка совершалась через Telegram, свяжите аккаунты или обновите статус Premium.',
  },
  {
    q: 'Как установить GameNight Host на телефон?',
    a: 'Откройте сайт в браузере.\n\nНа Android нажмите «Установить приложение», если кнопка доступна.\n\nНа iPhone в Safari нажмите «Поделиться» → «На экран «Домой»».',
  },
  {
    q: 'Что делать, если игра не загружается?',
    a: 'Попробуйте обновить страницу, закрыть и повторно открыть приложение, проверить интернет-соединение.\n\nЕсли проблема сохраняется, напишите в поддержку.',
  },
  {
    q: 'Как обратиться по вопросу оплаты или возврата?',
    a: 'Напишите в поддержку и укажите дату покупки и email для чека, если покупали на сайте.\n\nВозвраты рассматриваются согласно публичной оферте и законодательству РФ.\n\nНе отправляйте полные реквизиты банковской карты.',
  },
]

function FaqRow({ item, open, onToggle }: { item: FaqItem; open: boolean; onToggle: () => void }) {
  const panelId = useId()
  return (
    <div className={`profile-faq__item${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="profile-faq__q"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          haptic('light')
          onToggle()
        }}
      >
        <span>{item.q}</span>
        <span className="profile-faq__chev" aria-hidden>
          {open ? '−' : '+'}
        </span>
      </button>
      <div id={panelId} className="profile-faq__a" hidden={!open}>
        {item.a.split('\n\n').map((p) => (
          <p key={p.slice(0, 24)}>{p}</p>
        ))}
      </div>
    </div>
  )
}

export default function ProfileFaq() {
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.location.hash === '#faq') {
      document.getElementById('profile-faq')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  return (
    <section className="profile-faq" id="profile-faq" aria-labelledby="profile-faq-title">
      <h2 className="profile-menu__title" id="profile-faq-title">
        Частые вопросы
      </h2>
      <div className="profile-menu__panel profile-faq__panel">
        {FAQ_ITEMS.map((item, idx) => (
          <FaqRow
            key={item.q}
            item={item}
            open={openIdx === idx}
            onToggle={() => setOpenIdx((cur) => (cur === idx ? null : idx))}
          />
        ))}
      </div>
      <a
        className="profile-faq__support"
        href={GNH_OPERATOR.supportUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => haptic('light')}
      >
        Не нашли ответ? Напишите нам
      </a>
    </section>
  )
}
