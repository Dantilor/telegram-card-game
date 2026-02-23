import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTruthDare } from '../games/truth-dare/TruthDareContext'
import { TAGS, TAG_LABELS, TAG_EMOJIS } from '../games/truth-dare/types'
import { loadSettings, saveSettings } from '../games/truth-dare/settings'
import { useBack } from '../hooks/useBack'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import './TruthDareSetup.css'

const MIN_PLAYERS = 2
const MAX_PLAYERS = 8
const STEP_OPTIONS = [10, 20, 30] as const

function TruthDareSetup() {
  const navigate = useNavigate()
  const { dispatch } = useTruthDare()
  const [count, setCount] = useState(4)
  const [names, setNames] = useState<string[]>(() => Array(4).fill(''))
  const [steps, setSteps] = useState(20)
  const [tags, setTags] = useState<string[]>([])

  useEffect(() => {
    const s = loadSettings()
    if (s.lastPlayers.length >= 2) {
      setCount(s.lastPlayers.length)
      setNames(
        s.lastPlayers.map((name) =>
          /^Игрок \d+$/.test(name.trim()) ? '' : name
        )
      )
    }
    if (s.lastSteps) setSteps(s.lastSteps)
    /* Категории не восстанавливаем — игрок каждый раз выбирает сам */
  }, [])

  const updateCount = (n: number) => {
    hapticSelection()
    setCount(n)
    setNames((prev) => {
      const next = [...prev]
      while (next.length < n) next.push('')
      return next.slice(0, n)
    })
  }

  const toggleTag = (tag: string) => {
    hapticSelection()
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const handleStart = () => {
    const filled = names.slice(0, count).map((n, i) => n.trim() || `Игрок ${i + 1}`)
    if (filled.length < MIN_PLAYERS) return
    haptic('medium')
    saveSettings({ lastPlayers: filled, lastTags: tags, lastSteps: steps })
    dispatch({
      type: 'START',
      players: filled.map((name) => ({ name })),
      totalSteps: steps,
      tags,
    })
    navigate('/truth-dare/turn')
  }

  const handleBack = useBack('/games')

  return (
    <div className="truth-dare-setup">
      <div className="truth-dare-setup__top">
        <HomeButton />
        <button type="button" className="btn btn--ghost home-btn truth-dare-setup__back" onClick={handleBack}>
          ← В меню
        </button>
      </div>
      <header className="truth-dare-setup__header">
        <h1 className="truth-dare-setup__title">Правда или действие</h1>
        <p className="truth-dare-setup__tagline">Сначала выбор. Потом последствия.</p>
        <div className="truth-dare-setup__how card">
          <h3 className="truth-dare-setup__how-title">Как играть</h3>
          <ul className="truth-dare-setup__how-list">
            <li>Выбери правду или действие.</li>
            <li>Ответь честно или выполни задание.</li>
            <li>С каждым раундом игра становится смелее.</li>
          </ul>
        </div>
      </header>

      <section className="truth-dare-setup__section">
        <h2 className="truth-dare-setup__section-title">Количество участников</h2>
        <div className="truth-dare-setup__count-row">
          {Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i).map((n) => (
            <button
              key={n}
              type="button"
              className={`btn truth-dare-setup__count-btn ${count === n ? 'is-active' : ''}`}
              onClick={() => updateCount(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      <section className="truth-dare-setup__section">
        <h2 className="truth-dare-setup__section-title">Количество ходов</h2>
        <div className="truth-dare-setup__steps-row">
          {STEP_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              className={`btn truth-dare-setup__step-btn ${steps === n ? 'is-active' : ''}`}
              onClick={() => { hapticSelection(); setSteps(n) }}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      <section className="truth-dare-setup__section">
        <h2 className="truth-dare-setup__section-title">Категории <span className="truth-dare-setup__section-hint">(выберите одну или несколько)</span></h2>
        <div className="truth-dare-setup__categories">
          {TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`truth-dare-setup__category-card card ${tags.includes(tag) ? 'truth-dare-setup__category-card--active' : ''}`}
              onClick={() => toggleTag(tag)}
            >
              <span className="truth-dare-setup__category-emoji" aria-hidden>{TAG_EMOJIS[tag]}</span>
              <span className="truth-dare-setup__category-title">{TAG_LABELS[tag]}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="truth-dare-setup__section">
        <h2 className="truth-dare-setup__section-title">Введите имена участников</h2>
        <div className="truth-dare-setup__names">
          {names.slice(0, count).map((name, i) => (
            <input
              key={i}
              type="text"
              className="truth-dare-setup__input card"
              placeholder={`Игрок ${i + 1}`}
              value={name}
              onChange={(e) => {
                const next = [...names]
                next[i] = e.target.value
                setNames(next)
              }}
            />
          ))}
        </div>
      </section>

      <div className="truth-dare-setup__actions">
        <button
          type="button"
          className="btn btn--primary truth-dare-setup__start"
          onClick={handleStart}
          disabled={count < MIN_PLAYERS}
        >
          Начать раунд
        </button>
      </div>
    </div>
  )
}

export default TruthDareSetup
