import { useMemo, useState } from 'react'
import BackButton from '../../components/BackButton'
import HomeButton from '../../components/HomeButton'
import { useBack } from '../../hooks/useBack'
import { hapticSelection } from '../../utils/haptics'
import { TRANSLATOR_PHRASES, type TranslatorPhrase } from './translatorPhrases'
import './TranslatorGame.css'

type Screen = 'setup' | 'submit' | 'vote' | 'result' | 'final'

type Player = {
  id: string
  name: string
  score: number
}

const PLAYER_COUNTS = [2, 3, 4, 5, 6, 7, 8]
const ROUND_COUNTS = [5, 7, 10]

function shufflePhrases() {
  return [...TRANSLATOR_PHRASES].sort(() => Math.random() - 0.5)
}

function makeDefaultNames(count: number) {
  return Array.from({ length: count }, (_, i) => `Игрок ${i + 1}`)
}

function getModeLabel(mode: TranslatorPhrase['mode']) {
  if (mode === 'drunk') return 'пьяный вайб'
  if (mode === 'female') return 'женский контекст'
  if (mode === 'male') return 'мужской контекст'
  return 'офисный хаос'
}

function TranslatorGame() {
  const handleBack = useBack('/games')
  const [screen, setScreen] = useState<Screen>('setup')
  const [playerCount, setPlayerCount] = useState(4)
  const [roundCount, setRoundCount] = useState(7)
  const [names, setNames] = useState(() => makeDefaultNames(4))
  const [players, setPlayers] = useState<Player[]>([])
  const [phrases, setPhrases] = useState<TranslatorPhrase[]>([])
  const [roundIndex, setRoundIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [votes, setVotes] = useState<Record<string, string>>({})
  const [roundWinners, setRoundWinners] = useState<string[]>([])

  const currentPhrase = phrases[roundIndex]
  const sortedPlayers = useMemo(() => [...players].sort((a, b) => b.score - a.score), [players])
  const allAnswered = players.every((player) => answers[player.id]?.trim())
  const allVoted = players.every((player) => votes[player.id])

  const setCount = (count: number) => {
    setPlayerCount(count)
    setNames((prev) => {
      const next = [...prev]
      while (next.length < count) next.push(`Игрок ${next.length + 1}`)
      return next.slice(0, count)
    })
  }

  const startGame = () => {
    hapticSelection()
    setPlayers(names.slice(0, playerCount).map((name, index) => ({
      id: `p-${index + 1}`,
      name: name.trim() || `Игрок ${index + 1}`,
      score: 0,
    })))
    setPhrases(shufflePhrases().slice(0, roundCount))
    setRoundIndex(0)
    setAnswers({})
    setVotes({})
    setRoundWinners([])
    setScreen('submit')
  }

  const showVoting = () => {
    hapticSelection()
    if (!allAnswered) return
    setVotes({})
    setScreen('vote')
  }

  const finishVoting = () => {
    hapticSelection()
    if (!allVoted) return
    const tally = players.reduce<Record<string, number>>((acc, player) => {
      acc[player.id] = 0
      return acc
    }, {})
    Object.values(votes).forEach((answerPlayerId) => {
      tally[answerPlayerId] = (tally[answerPlayerId] ?? 0) + 1
    })
    const maxVotes = Math.max(...Object.values(tally))
    const winners = players.filter((player) => tally[player.id] === maxVotes).map((player) => player.id)
    setRoundWinners(winners)
    setPlayers((prev) => prev.map((player) => (
      winners.includes(player.id) ? { ...player, score: player.score + 1 } : player
    )))
    setScreen('result')
  }

  const nextRound = () => {
    hapticSelection()
    if (roundIndex + 1 >= phrases.length) {
      setScreen('final')
      return
    }
    setRoundIndex((value) => value + 1)
    setAnswers({})
    setVotes({})
    setRoundWinners([])
    setScreen('submit')
  }

  const resetGame = () => {
    hapticSelection()
    setScreen('setup')
    setPlayers([])
    setPhrases([])
    setRoundIndex(0)
    setAnswers({})
    setVotes({})
    setRoundWinners([])
  }

  return (
    <div className="translator-page game-shell">
      <div className="game-shell__top">
        <HomeButton />
        <BackButton onClick={handleBack} />
      </div>

      <header className="translator-hero card">
        <span className="translator-eyebrow">новая игра</span>
        <h1>Переводчик</h1>
        <p>Абсурдная фраза появляется на экране. Каждый пишет смешной перевод на человеческий язык, потом компания голосует.</p>
      </header>

      {screen === 'setup' && (
        <section className="translator-panel card">
          <h2>Кто сегодня переводит?</h2>
          <div className="translator-choice">
            <span>Игроки</span>
            <div className="translator-pills">
              {PLAYER_COUNTS.map((count) => (
                <button key={count} type="button" className={count === playerCount ? 'is-active' : ''} onClick={() => setCount(count)}>{count}</button>
              ))}
            </div>
          </div>
          <div className="translator-choice">
            <span>Раунды</span>
            <div className="translator-pills">
              {ROUND_COUNTS.map((count) => (
                <button key={count} type="button" className={count === roundCount ? 'is-active' : ''} onClick={() => setRoundCount(count)}>{count}</button>
              ))}
            </div>
          </div>
          <div className="translator-names">
            {names.slice(0, playerCount).map((name, index) => (
              <label key={index}>
                <span>Игрок {index + 1}</span>
                <input value={name} onChange={(event) => {
                  const next = [...names]
                  next[index] = event.target.value
                  setNames(next)
                }} />
              </label>
            ))}
          </div>
          <button className="translator-primary" type="button" onClick={startGame}>Начать переводить</button>
        </section>
      )}

      {screen === 'submit' && currentPhrase && (
        <section className="translator-board card">
          <div className="translator-progress">Раунд {roundIndex + 1} из {phrases.length}</div>
          <article className="translator-phrase">
            <span>{getModeLabel(currentPhrase.mode)}</span>
            <h2>{currentPhrase.title}</h2>
            <p>«{currentPhrase.phrase}»</p>
            <small>{currentPhrase.context}</small>
          </article>
          <div className="translator-answers">
            {players.map((player) => (
              <label key={player.id} className="translator-answer-field">
                <span>{player.name}</span>
                <textarea
                  value={answers[player.id] ?? ''}
                  placeholder="Напиши смешной перевод..."
                  onChange={(event) => setAnswers((prev) => ({ ...prev, [player.id]: event.target.value }))}
                />
              </label>
            ))}
          </div>
          <button className="translator-primary" type="button" disabled={!allAnswered} onClick={showVoting}>Перейти к голосованию</button>
        </section>
      )}

      {screen === 'vote' && currentPhrase && (
        <section className="translator-board card">
          <div className="translator-progress">Голосование</div>
          <article className="translator-phrase translator-phrase--compact">
            <span>{getModeLabel(currentPhrase.mode)}</span>
            <p>«{currentPhrase.phrase}»</p>
          </article>
          <div className="translator-voters">
            {players.map((voter) => (
              <div key={voter.id} className="translator-voter">
                <strong>{voter.name} голосует</strong>
                <div className="translator-vote-grid">
                  {players.map((answerOwner) => {
                    const selfVoteDisabled = players.length > 2 && voter.id === answerOwner.id
                    return (
                      <button
                        key={answerOwner.id}
                        type="button"
                        disabled={selfVoteDisabled}
                        className={votes[voter.id] === answerOwner.id ? 'is-active' : ''}
                        onClick={() => {
                          hapticSelection()
                          setVotes((prev) => ({ ...prev, [voter.id]: answerOwner.id }))
                        }}
                      >
                        <b>{answerOwner.name}</b>
                        <span>{answers[answerOwner.id]}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          <button className="translator-primary" type="button" disabled={!allVoted} onClick={finishVoting}>Показать победителя</button>
        </section>
      )}

      {screen === 'result' && currentPhrase && (
        <section className="translator-panel card">
          <span className="translator-eyebrow">лучший перевод</span>
          <h2>{roundWinners.length > 1 ? 'Ничья, но смешная' : 'Победитель раунда'}</h2>
          <div className="translator-result-list">
            {roundWinners.map((winnerId) => {
              const winner = players.find((player) => player.id === winnerId)
              if (!winner) return null
              return (
                <div key={winner.id}>
                  <strong>{winner.name}</strong>
                  <p>{answers[winner.id]}</p>
                </div>
              )
            })}
          </div>
          <button className="translator-primary" type="button" onClick={nextRound}>
            {roundIndex + 1 >= phrases.length ? 'Показать итоги' : 'Следующая фраза'}
          </button>
        </section>
      )}

      {screen === 'final' && (
        <section className="translator-panel card">
          <span className="translator-eyebrow">финал</span>
          <h2>Главный переводчик вечера</h2>
          <div className="translator-scoreboard">
            {sortedPlayers.map((player, index) => (
              <div key={player.id}>
                <span>{index + 1}</span>
                <strong>{player.name}</strong>
                <em>{player.score} балл(ов)</em>
              </div>
            ))}
          </div>
          <button className="translator-primary" type="button" onClick={resetGame}>Сыграть ещё раз</button>
        </section>
      )}
    </div>
  )
}

export default TranslatorGame
