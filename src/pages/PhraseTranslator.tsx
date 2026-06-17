import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { haptic } from '../utils/telegram'
import { hapticSelection } from '../utils/haptics'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import GamesPageHeader from '../components/GamesPageHeader'
import GameExitConfirmModal from '../components/GameExitConfirmModal'
import PremiumOverlay from '../components/PremiumOverlay'
import { useGameStartGate } from '../hooks/useGameStartGate'
import {
  accumulateVotesReceived,
  applyRoundScores,
  advanceSpokenAnswerTurn,
  canVote,
  computeFinalStats,
  computeRoundResults,
  createPlayer,
  getCurrentAnswerPlayerId,
  getCurrentVotingPlayerId,
  incrementAutoAnswerCount,
  initRound,
  isOwnAnswer,
  skipAnswer,
  startVotingPhase,
  submitAnswer,
  submitVote,
} from '../games/phrase-translator/engine'
import { preparePhrasesForGame } from '../games/phrase-translator/phrases'
import type {
  PhraseCard,
  RoundCountOption,
  TranslatorGameState,
} from '../games/phrase-translator/types'
import { MICRO_HINTS, MIN_PLAYERS, ROUND_COUNT_OPTIONS } from '../games/phrase-translator/types'
import '../styles/GamePageShell.css'
import './PhraseTranslator.css'

const MAX_PLAYERS = 10

type AnswerMode = 'write' | 'speak'

const CATEGORY_ICONS = ['🍻', '🐍', '🗿', '👔', '🤯', '💔', '📦', '🏡', '💕', '🎉'] as const

const INITIAL_GAME: TranslatorGameState = {
  phase: 'setup',
  roundCount: 7,
  players: [],
  phrases: [],
  round: null,
  autoAnswerCounts: {},
  totalVotesReceived: {},
}

function pickHint(index: number): string {
  return MICRO_HINTS[index % MICRO_HINTS.length]
}

function CategoryBadge({ phrase }: { phrase: PhraseCard }) {
  return (
    <span className={`pt__badge pt__badge--${phrase.category}`}>{phrase.categoryLabel}</span>
  )
}

function PhraseHero({ phrase, roundLabel }: { phrase: PhraseCard; roundLabel?: string }) {
  return (
    <article className="pt__phrase game-page__panel game-page__panel--glow-a">
      <div className="pt__phrase-meta">
        {roundLabel && <span className="game-page__progress pt__phrase-round">{roundLabel}</span>}
        <CategoryBadge phrase={phrase} />
      </div>
      <blockquote className="pt__phrase-text">«{phrase.text}»</blockquote>
      <p className="pt__phrase-hint">{phrase.hint}</p>
    </article>
  )
}

export default function PhraseTranslator() {
  const navigate = useNavigate()

  const [game, setGame] = useState<TranslatorGameState>(INITIAL_GAME)
  const [participantCount, setParticipantCount] = useState(MIN_PLAYERS)
  const [names, setNames] = useState<string[]>(() => Array(MIN_PLAYERS).fill(''))
  const [answerInput, setAnswerInput] = useState('')
  const [answerMode, setAnswerMode] = useState<AnswerMode>('write')
  const [showExitConfirm, setShowExitConfirm] = useState<'setup' | 'games' | 'home' | null>(null)
  const { startLocked, premiumOverlayOpen, closePremiumOverlay, gatedStart, startCtaClassName } =
    useGameStartGate('phrase-translator')

  const hasSetupData =
    names.some((name) => name.trim() !== '') ||
    participantCount !== MIN_PLAYERS ||
    game.roundCount !== INITIAL_GAME.roundCount


  const roundNumber = (game.round?.roundIndex ?? 0) + 1
  const totalRounds = game.phrases.length
  const progressPct = totalRounds > 0 ? (roundNumber / totalRounds) * 100 : 0
  const roundLabel = totalRounds > 0 ? `Раунд ${roundNumber} из ${totalRounds}` : ''

  const answerPlayerId = game.round ? getCurrentAnswerPlayerId(game.round, game.players) : null
  const answerPlayer = useMemo(
    () => game.players.find((p) => p.id === answerPlayerId) ?? null,
    [game.players, answerPlayerId]
  )

  useEffect(() => {
    setAnswerInput('')
    setAnswerMode('write')
  }, [answerPlayerId, game.round?.roundIndex])

  const votingPlayerId = game.round ? getCurrentVotingPlayerId(game.round, game.players) : null
  const votingPlayer = useMemo(
    () => game.players.find((p) => p.id === votingPlayerId) ?? null,
    [game.players, votingPlayerId]
  )

  const finalStats = useMemo(() => {
    if (game.phase !== 'final') return null
    return computeFinalStats(game.players, game.totalVotesReceived, game.autoAnswerCounts)
  }, [game.phase, game.players, game.totalVotesReceived, game.autoAnswerCounts])

  const shuffledAnswers = useMemo(() => {
    if (!game.round) return []
    const map = new Map(game.round.answers.map((a) => [a.id, a]))
    return game.round.shuffledAnswerIds
      .map((id) => map.get(id))
      .filter((a): a is NonNullable<typeof a> => Boolean(a))
  }, [game.round])

  const handleUpdateCount = (count: number) => {
    hapticSelection()
    setParticipantCount(count)
    setNames((prev) => {
      const next = [...prev]
      while (next.length < count) next.push('')
      return next.slice(0, count)
    })
  }

  const handleUpdateName = (index: number, value: string) => {
    setNames((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  const handleStartGame = () => {
    if (participantCount < MIN_PLAYERS) return
    haptic('medium')
    const filled = names.slice(0, participantCount).map((n, i) => n.trim() || `Игрок ${i + 1}`)
    const players = filled.map((name) => createPlayer(name))
    const phrases = preparePhrasesForGame(game.roundCount)
    setGame((prev) => ({
      ...prev,
      phase: 'answers',
      players,
      phrases,
      round: initRound(0, phrases[0]),
      autoAnswerCounts: {},
      totalVotesReceived: {},
    }))
  }

  const finishVotingPhase = (
    round: NonNullable<TranslatorGameState['round']>,
    extra?: Partial<TranslatorGameState>
  ) => {
    const results = computeRoundResults(round, game.players.length)
    const updatedPlayers = applyRoundScores(game.players, results)
    const totalVotesReceived = accumulateVotesReceived(game.totalVotesReceived, results)
    setGame((prev) => ({
      ...prev,
      ...extra,
      phase: 'reveal',
      players: updatedPlayers,
      totalVotesReceived,
      round: { ...round, revealResults: results },
    }))
  }

  const finishAnswerPhase = (
    round: NonNullable<TranslatorGameState['round']>,
    extra?: Partial<TranslatorGameState>
  ) => {
    if (round.answers.length === 0) {
      finishVotingPhase({ ...round, revealResults: [] }, extra)
      return
    }
    const votingRound = startVotingPhase(round)
    setGame((prev) => ({ ...prev, ...extra, phase: 'voting', round: votingRound }))
  }

  useEffect(() => {
    if (game.phase !== 'voting' || !game.round || !votingPlayerId) return
    if (canVote(game.round, votingPlayerId)) return

    const next = { ...game.round, votingTurnIndex: game.round.votingTurnIndex + 1 }
    if (next.votingTurnIndex >= game.players.length) {
      finishVotingPhase(next)
      return
    }
    setGame((prev) => ({ ...prev, round: next }))
  }, [game.phase, game.round, game.players.length, votingPlayerId])

  const handleSaveAnswer = () => {
    if (!game.round || !answerPlayerId) return
    const text = answerInput.trim()
    if (!text) {
      haptic('light')
      return
    }
    const next = submitAnswer(game.round, answerPlayerId, game.players, text)
    if (!next) return
    haptic('light')
    setAnswerInput('')
    if (next.answerTurnIndex >= game.players.length) {
      finishAnswerPhase(next)
      return
    }
    setGame((prev) => ({ ...prev, round: next }))
  }

  const handleSpokenAnswer = () => {
    if (!game.round || !answerPlayerId) return
    const next = advanceSpokenAnswerTurn(game.round, answerPlayerId, game.players)
    if (!next) return
    haptic('light')
    setAnswerInput('')
    if (next.answerTurnIndex >= game.players.length) {
      finishAnswerPhase(next)
      return
    }
    setGame((prev) => ({ ...prev, round: next }))
  }

  const handlePrimaryAnswerAction = () => {
    if (answerMode === 'speak') {
      handleSpokenAnswer()
      return
    }
    handleSaveAnswer()
  }

  const handleSkipAnswer = () => {
    if (!game.round || !answerPlayerId) return
    const next = skipAnswer(game.round, answerPlayerId, game.players)
    if (!next) return
    hapticSelection()
    const autoAnswerCounts = incrementAutoAnswerCount(game.autoAnswerCounts, answerPlayerId)
    if (next.answerTurnIndex >= game.players.length) {
      finishAnswerPhase(next, { autoAnswerCounts })
      return
    }
    setGame((prev) => ({ ...prev, round: next, autoAnswerCounts }))
  }

  const handleVote = (answerId: string) => {
    if (!game.round || !votingPlayerId) return
    const next = submitVote(game.round, votingPlayerId, game.players, answerId)
    if (!next) return
    haptic('light')
    if (next.votingTurnIndex >= game.players.length) {
      finishVotingPhase(next)
      return
    }
    setGame((prev) => ({ ...prev, round: next }))
  }

  const handleNextRound = () => {
    if (!game.round) return
    haptic('medium')
    const nextIndex = game.round.roundIndex + 1
    if (nextIndex >= game.phrases.length) {
      setGame((prev) => ({ ...prev, phase: 'final', round: null }))
      return
    }
    setGame((prev) => ({
      ...prev,
      phase: 'answers',
      round: initRound(nextIndex, prev.phrases[nextIndex]),
    }))
  }

  const handleNewGame = () => {
    hapticSelection()
    resetLocalState()
  }

  const resetLocalState = () => {
    setParticipantCount(MIN_PLAYERS)
    setNames(Array(MIN_PLAYERS).fill(''))
    setAnswerInput('')
    setAnswerMode('write')
    setGame(INITIAL_GAME)
  }

  const returnToSetup = () => {
    const playerNames = game.players.map((player) => player.name)
    if (playerNames.length > 0) {
      setParticipantCount(playerNames.length)
      setNames(playerNames)
    }
    setAnswerInput('')
    setAnswerMode('write')
    setGame({
      phase: 'setup',
      roundCount: game.roundCount,
      players: [],
      phrases: [],
      round: null,
      autoAnswerCounts: {},
      totalVotesReceived: {},
    })
  }

  const handleExitConfirm = (confirmed: boolean) => {
    const target = showExitConfirm
    setShowExitConfirm(null)
    if (!confirmed || !target) return
    haptic('light')
    if (target === 'setup') {
      returnToSetup()
      return
    }
    resetLocalState()
    navigate(target === 'home' ? '/' : '/games')
  }

  const handleBackAction = () => {
    if (game.phase === 'setup') {
      if (hasSetupData) {
        setShowExitConfirm('games')
      } else {
        navigate('/games')
      }
      return
    }
    if (game.phase === 'final') {
      returnToSetup()
      return
    }
    setShowExitConfirm('setup')
  }

  const handleHomeBeforeNavigate = () => {
    if (game.phase !== 'setup' || hasSetupData) {
      setShowExitConfirm('home')
      return true
    }
    resetLocalState()
    return false
  }

  const isLastRound = game.round ? game.round.roundIndex >= game.phrases.length - 1 : false

  return (
    <div className="game-page pt game-page--enter">
      <div className="game-page__top">
        <HomeButton className="game-page__nav-btn" onBeforeNavigate={handleHomeBeforeNavigate} />
        <BackButton onClick={handleBackAction} className="game-page__nav-btn game-page__back" />
      </div>

      {game.phase === 'setup' && (
        <div className="pt__setup-screen">
          <div className="pt__setup-scroll">
            <GamesPageHeader
              title="Переводчик фраз"
              tagline="Расшифруй фразу — собери голоса"
            />

            <div className="pt__intro-hero" aria-hidden>
              {CATEGORY_ICONS.map((icon) => (
                <span key={icon} className="pt__intro-icon">{icon}</span>
              ))}
            </div>

            <div className="pt__how game-page__panel game-page__panel--glow-b">
              <h3 className="pt__how-title">Как играть</h3>
              <ul className="pt__how-list">
                <li>Странная фраза — каждый пишет или говорит свой перевод</li>
                <li>Голосуете за самый смешной или жизненный вариант</li>
                <li>+100 за голос, +50 бонус за «Выбор народа»</li>
                <li>Передавайте телефон по кругу</li>
              </ul>
            </div>

            <section className="pt__section game-page__section">
              <h2 className="game-page__section-title">Количество участников</h2>
              <div className="game-page__chip-row">
                {Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i).map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`game-page__chip ${participantCount === n ? 'is-active' : ''}`}
                    onClick={() => handleUpdateCount(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="pt__section-hint">Лучше всего играть компанией от 4 человек</p>
            </section>

            <section className="pt__section game-page__section">
              <h2 className="game-page__section-title">Количество раундов</h2>
              <div className="game-page__chip-row">
                {ROUND_COUNT_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`game-page__chip game-page__chip--wide ${game.roundCount === n ? 'is-active' : ''}`}
                    onClick={() => {
                      hapticSelection()
                      setGame((prev) => ({ ...prev, roundCount: n as RoundCountOption }))
                    }}
                  >
                    {n} раундов
                  </button>
                ))}
              </div>
            </section>

            <section className="pt__section game-page__section pt__section--names">
              <h2 className="game-page__section-title">Введите имена участников</h2>
              <div className="pt__names">
                {names.slice(0, participantCount).map((name, i) => (
                  <input
                    key={i}
                    type="text"
                    className="game-page__input"
                    placeholder={`Игрок ${i + 1}`}
                    value={name}
                    maxLength={24}
                    onChange={(e) => handleUpdateName(i, e.target.value)}
                  />
                ))}
              </div>
            </section>
          </div>

          <div className="game-page__actions pt__setup-actions">
            <button
              type="button"
              className={startCtaClassName}
              disabled={!startLocked && participantCount < MIN_PLAYERS}
              onClick={() => gatedStart(handleStartGame)}
            >
              Начать перевод
            </button>
          </div>
        </div>
      )}

      {game.phase === 'answers' && game.round && answerPlayer && (
        <>
          <div className="pt__phase-head">
            <div className="pt__track-wrap">
              <span className="game-page__progress">{roundLabel}</span>
              <div className="pt__track" aria-hidden>
                <div className="pt__track-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <p className="pt__micro-hint">{pickHint(game.round.roundIndex)}</p>
            </div>
            <p className="pt__turn-label">
              Ходит: <strong>{answerPlayer.name}</strong>
            </p>
            <PhraseHero phrase={game.round.phrase} />
          </div>
          <section className="pt__answer-form game-page__section">
            <p className="pt__answer-hint">
              Вы в одной комнате: можно написать перевод или сказать его вслух.
            </p>
            <div className="pt__answer-mode" role="tablist" aria-label="Способ ответа">
              <button
                type="button"
                role="tab"
                aria-selected={answerMode === 'write'}
                className={`pt__answer-mode-btn${answerMode === 'write' ? ' is-active' : ''}`}
                onClick={() => {
                  hapticSelection()
                  setAnswerMode('write')
                }}
              >
                ✍️ Написать
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={answerMode === 'speak'}
                className={`pt__answer-mode-btn${answerMode === 'speak' ? ' is-active' : ''}`}
                onClick={() => {
                  hapticSelection()
                  setAnswerInput('')
                  setAnswerMode('speak')
                }}
              >
                🎤 Сказать
              </button>
            </div>

            {answerMode === 'write' ? (
              <textarea
                className="pt__answer-input game-page__input"
                placeholder="Что это значит на нормальном языке?"
                value={answerInput}
                maxLength={280}
                rows={4}
                onChange={(e) => setAnswerInput(e.target.value)}
              />
            ) : (
              <div className="pt__answer-speak game-page__panel game-page__panel--glow-b">
                <span className="pt__answer-speak-icon" aria-hidden>🎤</span>
                <p className="pt__answer-speak-title">Скажи перевод вслух</p>
                <p className="pt__answer-speak-text">
                  Все в комнате услышат твой вариант. Когда закончишь — нажми «Готово, сказал».
                </p>
              </div>
            )}
          </section>
          <div className="game-page__actions pt__answer-actions">
            <button
              type="button"
              className="game-page__cta"
              onClick={handlePrimaryAnswerAction}
            >
              {answerMode === 'speak' ? 'Готово, сказал' : 'Сохранить ответ'}
            </button>
            <button type="button" className="game-page__btn game-page__btn--secondary" onClick={handleSkipAnswer}>
              Пропустить
            </button>
          </div>
        </>
      )}

      {game.phase === 'voting' &&
        game.round &&
        votingPlayer &&
        canVote(game.round, votingPlayer.id) && (
        <>
          <header className="pt__vote-head">
            <h2 className="pt__vote-title">Выберите лучший перевод</h2>
            <p className="pt__vote-desc">
              Голосуйте за самый смешной, точный или жизненный вариант. За свой ответ голосовать
              нельзя.
            </p>
            <p className="pt__micro-hint pt__micro-hint--center">
              Ответы анонимные. Пока что.
            </p>
            <p className="pt__turn-label">
              Голосует: <strong>{votingPlayer.name}</strong>
            </p>
          </header>

          <ul className="pt__vote-list">
            {shuffledAnswers.map((answer) => {
              const own = isOwnAnswer(game.round!, votingPlayer.id, answer.id)
              return (
                <li key={answer.id}>
                  <button
                    type="button"
                    className={`pt__vote-card game-page__panel game-page__panel--glow-b${own ? ' pt__vote-card--own' : ''}`}
                    disabled={own}
                    onClick={() => handleVote(answer.id)}
                  >
                    <span className="pt__vote-card-text">{answer.text}</span>
                    {own && <span className="pt__vote-own-label">Это ваш ответ</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {game.phase === 'reveal' && game.round && (
        <div className="pt__body">
          <div className="pt__scroll">
            <header className="pt__reveal-head">
              <h1 className="pt__reveal-title">Раунд раскрыт</h1>
              <p className="pt__micro-hint pt__micro-hint--center">Раунд раскрыт. Держитесь.</p>
            </header>

            <PhraseHero phrase={game.round.phrase} roundLabel={roundLabel} />

            <section className="pt__discuss game-page__panel game-page__panel--glow-b">
              <p className="pt__discuss-title">Обсудите свои переводы</p>
              <p className="pt__discuss-text">
                Сравните вслух, кто как понял фразу. Самый смешной или точный вариант можно
                отметить прямо в комнате — без голосования в приложении.
              </p>
            </section>
          </div>

          <div className="game-page__actions">
            <button type="button" className="game-page__cta" onClick={handleNextRound}>
              {isLastRound ? 'Показать финал' : 'Следующий раунд'}
            </button>
          </div>
        </div>
      )}

      {game.phase === 'final' && finalStats && (
        <div className="pt__body">
          <div className="pt__scroll">
            <header className="pt__final-head">
              <h1 className="pt__final-title">Перевод окончен</h1>
              {finalStats.winner && (
                <p className="pt__final-winner">
                  Лучший переводчик вечера: <strong>{finalStats.winner.name}</strong>
                </p>
              )}
            </header>

            <div className="pt__nominations">
              {finalStats.winner && (
                <div className="pt__nomination game-page__panel game-page__panel--glow-a">
                  🏆 Мастер подтекста: <strong>{finalStats.winner.name}</strong>
                </div>
              )}
              {finalStats.mostVoted && (
                <div className="pt__nomination game-page__panel game-page__panel--glow-a">
                  💬 Самый жизненный: <strong>{finalStats.mostVoted.name}</strong> (
                  {game.totalVotesReceived[finalStats.mostVoted.id] ?? 0} голосов)
                </div>
              )}
              {finalStats.mostAutoAnswers && (
                <div className="pt__nomination game-page__panel game-page__panel--glow-a">
                  🍞 Хлебушек вечера: <strong>{finalStats.mostAutoAnswers.name}</strong> (
                  {game.autoAnswerCounts[finalStats.mostAutoAnswers.id] ?? 0} автоответов)
                </div>
              )}
            </div>

            <section className="game-page__section">
              <h2 className="game-page__section-title">Итоговый рейтинг</h2>
              <ol className="pt__leaderboard">
                {finalStats.ranking.map((p, i) => (
                  <li
                    key={p.id}
                    className={`pt__leaderboard-item game-page__panel game-page__panel--glow-b${i === 0 ? ' pt__leaderboard-item--top' : ''}`}
                  >
                    <span className="pt__leaderboard-rank">{i + 1}</span>
                    <span className="pt__leaderboard-name">{p.name}</span>
                    <span className="pt__leaderboard-score">{p.score}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <div className="game-page__actions pt__final-actions">
            <button type="button" className="game-page__cta" onClick={handleNewGame}>
              Новая игра
            </button>
            <button
              type="button"
              className="game-page__btn game-page__btn--secondary"
              onClick={() => navigate('/games')}
            >
              Назад в меню
            </button>
          </div>
        </div>
      )}

      {showExitConfirm != null && (
        <GameExitConfirmModal
          title={showExitConfirm === 'setup' ? 'Вернуться к настройке?' : 'Выйти из игры?'}
          hint={
            showExitConfirm === 'setup'
              ? 'Текущий раунд сбросится — очки и ответы не сохранятся. Имена участников останутся.'
              : showExitConfirm === 'home'
                ? 'Текущий прогресс сбросится — вы вернётесь на главный экран.'
                : 'Если выйти, настройки и имена участников будут сброшены.'
          }
          confirmLabel={showExitConfirm === 'setup' ? 'В меню' : 'Выйти'}
          titleId="pt-exit-title"
          onCancel={() => handleExitConfirm(false)}
          onConfirm={() => handleExitConfirm(true)}
        />
      )}

      <PremiumOverlay isOpen={premiumOverlayOpen} onClose={closePremiumOverlay} />
    </div>
  )
}
