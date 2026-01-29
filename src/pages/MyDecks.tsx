import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLocalState } from '../hooks/useLocalState'
import { defaultUserState, type UserState } from '../data/types'
import { useCustomDecks } from '../hooks/useCustomDecks'
import { getTg, haptic } from '../utils/telegram'
import { createInvoice, openInvoice } from '../api/subscription'
import HomeButton from '../components/HomeButton'
import './MyDecks.css'

function MyDecks() {
  const navigate = useNavigate()
  const [state] = useLocalState<UserState>('tcg_state', defaultUserState)
  const { decks } = useCustomDecks()
  const inTelegram = !!getTg()?.initData
  const [invoiceLoading, setInvoiceLoading] = useState<'month' | 'year' | null>(null)

  const handleBack = () => {
    haptic('light')
    if (window.history.length > 1) navigate(-1)
    else navigate('/decks')
  }

  if (!state.premium) {
    const handleBuy = (plan: 'month' | 'year') => {
      haptic('light')
      if (!inTelegram) return
      setInvoiceLoading(plan)
      createInvoice(plan)
        .then(({ invoiceLink }) => openInvoice(invoiceLink))
        .catch(() => {})
        .finally(() => setInvoiceLoading(null))
    }
    return (
      <div className="my-decks-page">
        <div className="my-decks-page__top">
          <HomeButton />
          <button type="button" className="btn btn--ghost my-decks-page__back" onClick={handleBack}>
            ← Назад
          </button>
        </div>
        <h1 className="my-decks-page__title">Мои колоды</h1>
        <div className="my-decks-page__paywall card">
          <p className="my-decks-page__paywall-text">
            Персональные колоды доступны по подписке Premium.
          </p>
          {inTelegram ? (
            <div className="my-decks-page__paywall-buttons">
              <button
                type="button"
                className="btn btn--primary"
                disabled={invoiceLoading !== null}
                onClick={() => handleBuy('month')}
              >
                {invoiceLoading === 'month' ? 'Загрузка…' : '299 ₽/мес'}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={invoiceLoading !== null}
                onClick={() => handleBuy('year')}
              >
                {invoiceLoading === 'year' ? 'Загрузка…' : '1990 ₽/год'}
              </button>
            </div>
          ) : (
            <p className="my-decks-page__paywall-muted">
              Откройте Mini App в Telegram, чтобы оформить Premium.
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="my-decks-page">
      <div className="my-decks-page__top">
        <HomeButton />
        <button type="button" className="btn btn--ghost my-decks-page__back" onClick={handleBack}>
          ← Назад
        </button>
      </div>
      <h1 className="my-decks-page__title">Мои колоды</h1>
      <Link
        to="/decks/custom/new"
        className="btn btn--primary my-decks-page__create"
        onClick={() => haptic('light')}
      >
        ➕ Создать колоду
      </Link>
      {decks.length === 0 ? (
        <div className="my-decks-page__empty card">
          <p className="my-decks-page__empty-text">Создай свою первую колоду 💜</p>
          <Link
            to="/decks/custom/new"
            className="btn btn--ghost"
            onClick={() => haptic('light')}
          >
            Создать колоду
          </Link>
        </div>
      ) : (
        <ul className="my-decks-list">
          {decks.map((deck) => (
            <li key={deck.id} className="my-decks-item card">
              <Link to={`/play/${deck.id}`} className="my-decks-item__link">
                <span className="my-decks-item__title">{deck.title}</span>
                <span className="my-decks-item__count font-mono">{deck.questions.length}</span>
              </Link>
              <Link
                to={`/decks/custom/${deck.id}/edit`}
                className="btn btn--ghost my-decks-item__edit"
                onClick={() => haptic('light')}
              >
                Редактировать
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default MyDecks
