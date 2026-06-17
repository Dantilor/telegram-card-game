import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTruthDare } from '../games/truth-dare/TruthDareContext'
import { TAGS, TAG_LABELS, TAG_EMOJIS } from '../games/truth-dare/types'
import { loadSettings, saveSettings } from '../games/truth-dare/settings'
import { useBack } from '../hooks/useBack'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import GamesPageHeader from '../components/GamesPageHeader'
import AdultConfirmModal from '../components/AdultConfirmModal'
import PremiumOverlay from '../components/PremiumOverlay'
import { useGameStartGate } from '../hooks/useGameStartGate'
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
  const [adultConfirmOpen, setAdultConfirmOpen] = useState(false)
  const [pendingAdultTag, setPendingAdultTag] = useState<string | null>(null)
  const { startLocked, premiumOverlayOpen, closePremiumOverlay, gatedStart, startCtaClassName } =
    useGameStartGate('truth-dare')

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
    if (tag === '18plus' || tag === 'intim') {
      if (tags.includes(tag)) {
        setTags((prev) => prev.filter((t) => t !== tag))
        return
      }
      setPendingAdultTag(tag)
      setAdultConfirmOpen(true)
      return
    }
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const handleAdultConfirm = () => {
    setAdultConfirmOpen(false)
    const tag = pendingAdultTag
    setPendingAdultTag(null)
    if (tag) setTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]))
  }

  const handleAdultCancel = () => {
    setAdultConfirmOpen(false)
    setPendingAdultTag(null)
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
    <div className="game-page truth-dare-setup game-page--enter">
      <div className="game-page__top">
        <HomeButton className="game-page__nav-btn" />
        <BackButton onClick={handleBack} className="game-page__nav-btn game-page__back" />
      </div>

      <GamesPageHeader
        title="Правда или действие"
        tagline="Сначала выбор. Потом последствия."
      />

      <div className="truth-dare-setup__how game-page__panel game-page__panel--glow-b">
        <h3 className="truth-dare-setup__how-title">Как играть</h3>
        <ul className="truth-dare-setup__how-list">
          <li>Выбери правду или действие.</li>
          <li>Ответь честно или выполни задание.</li>
          <li>С каждым раундом игра становится смелее.</li>
        </ul>
      </div>

      <section className="truth-dare-setup__section game-page__section">
        <h2 className="game-page__section-title">Количество участников</h2>
        <div className="game-page__chip-row">
          {Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i).map((n) => (
            <button
              key={n}
              type="button"
              className={`game-page__chip ${count === n ? 'is-active' : ''}`}
              onClick={() => updateCount(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      <section className="truth-dare-setup__section game-page__section">
        <h2 className="game-page__section-title">Количество ходов</h2>
        <div className="game-page__chip-row">
          {STEP_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              className={`game-page__chip game-page__chip--wide ${steps === n ? 'is-active' : ''}`}
              onClick={() => { hapticSelection(); setSteps(n) }}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      <section className="truth-dare-setup__section game-page__section">
        <h2 className="game-page__section-title">
          Категории <span className="truth-dare-setup__section-hint">(выберите одну или несколько)</span>
        </h2>
        <div className="truth-dare-setup__categories">
          {TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`truth-dare-setup__category-card game-page__panel game-page__panel--glow-a game-page__category-card ${tags.includes(tag) ? 'is-active' : ''}`}
              onClick={() => toggleTag(tag)}
            >
              <span className="truth-dare-setup__category-emoji" aria-hidden>{TAG_EMOJIS[tag]}</span>
              <span className="truth-dare-setup__category-title game-page__category-title">
                <span className="truth-dare-setup__category-main">{TAG_LABELS[tag].main}</span>
                <span className="truth-dare-setup__category-sub">{TAG_LABELS[tag].sub}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="truth-dare-setup__section game-page__section">
        <h2 className="game-page__section-title">Введите имена участников</h2>
        <div className="truth-dare-setup__names">
          {names.slice(0, count).map((name, i) => (
            <input
              key={i}
              type="text"
              className="game-page__input"
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

      <div className="game-page__actions">
        <button
          type="button"
          className={startCtaClassName}
          onClick={() => gatedStart(handleStart)}
          disabled={!startLocked && count < MIN_PLAYERS}
        >
          Начать раунд
        </button>
      </div>

      <PremiumOverlay isOpen={premiumOverlayOpen} onClose={closePremiumOverlay} />

      <AdultConfirmModal
        isOpen={adultConfirmOpen}
        onConfirm={handleAdultConfirm}
        onCancel={handleAdultCancel}
      />
    </div>
  )
}

export default TruthDareSetup
