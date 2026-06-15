import { useMemo, useState } from 'react'
import BackButton from '../../components/BackButton'
import HomeButton from '../../components/HomeButton'
import { useBack } from '../../hooks/useBack'
import { hapticSelection } from '../../utils/haptics'
import { AUCTION_LOTS, type AuctionLot } from './auctionLots'
import './RidiculousAuctionGame.css'

type Screen = 'setup' | 'auction' | 'sold' | 'final'

type Player = {
  id: string
  name: string
  balance: number
  wins: number
}

type Sale = {
  lot: AuctionLot
  winnerName: string | null
  price: number
}

const START_MONEY = 1000
const PLAYER_COUNTS = [2, 3, 4, 5, 6, 7, 8]
const ROUND_COUNTS = [5, 7, 10]
const BID_STEPS = [50, 100, 200]

function shuffleLots() {
  return [...AUCTION_LOTS].sort(() => Math.random() - 0.5)
}

function makeDefaultNames(count: number) {
  return Array.from({ length: count }, (_, i) => `Игрок ${i + 1}`)
}

function getNextBid(currentBid: number, step: number, lot: AuctionLot) {
  return currentBid === 0 ? Math.max(lot.startPrice, step) : currentBid + step
}

function RidiculousAuctionGame() {
  const handleBack = useBack('/games')
  const [screen, setScreen] = useState<Screen>('setup')
  const [playerCount, setPlayerCount] = useState(4)
  const [roundCount, setRoundCount] = useState(7)
  const [names, setNames] = useState(() => makeDefaultNames(4))
  const [players, setPlayers] = useState<Player[]>([])
  const [lots, setLots] = useState<AuctionLot[]>([])
  const [roundIndex, setRoundIndex] = useState(0)
  const [leaderId, setLeaderId] = useState<string | null>(null)
  const [currentBid, setCurrentBid] = useState(0)
  const [sales, setSales] = useState<Sale[]>([])

  const currentLot = lots[roundIndex]
  const lastSale = sales[sales.length - 1]
  const leader = useMemo(() => players.find((p) => p.id === leaderId) ?? null, [leaderId, players])
  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => b.balance - a.balance || b.wins - a.wins),
    [players]
  )

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
    const preparedPlayers = names.slice(0, playerCount).map((name, i) => ({
      id: `p-${i + 1}`,
      name: name.trim() || `Игрок ${i + 1}`,
      balance: START_MONEY,
      wins: 0,
    }))
    setPlayers(preparedPlayers)
    setLots(shuffleLots().slice(0, roundCount))
    setRoundIndex(0)
    setLeaderId(null)
    setCurrentBid(0)
    setSales([])
    setScreen('auction')
  }

  const placeBid = (player: Player, step: number) => {
    if (!currentLot) return
    const nextBid = getNextBid(currentBid, step, currentLot)
    if (nextBid > player.balance) return
    hapticSelection()
    setLeaderId(player.id)
    setCurrentBid(nextBid)
  }

  const finishLot = () => {
    if (!currentLot) return
    hapticSelection()
    setPlayers((prev) => prev.map((player) => {
      if (player.id !== leaderId) return player
      return {
        ...player,
        balance: Math.max(0, player.balance - currentBid),
        wins: player.wins + 1,
      }
    }))
    setSales((prev) => [...prev, {
      lot: currentLot,
      winnerName: leader?.name ?? null,
      price: currentBid,
    }])
    setScreen('sold')
  }

  const nextLot = () => {
    hapticSelection()
    if (roundIndex + 1 >= lots.length) {
      setScreen('final')
      return
    }
    setRoundIndex((value) => value + 1)
    setLeaderId(null)
    setCurrentBid(0)
    setScreen('auction')
  }

  const resetGame = () => {
    hapticSelection()
    setScreen('setup')
    setPlayers([])
    setLots([])
    setRoundIndex(0)
    setLeaderId(null)
    setCurrentBid(0)
    setSales([])
  }

  return (
    <div className="auction-page game-shell">
      <div className="game-shell__top">
        <HomeButton />
        <BackButton onClick={handleBack} />
      </div>

      <header className="auction-hero card">
        <span className="auction-hero__eyebrow">новая игра</span>
        <h1>Аукцион нелепых услуг</h1>
        <p>Игроки торгуются виртуальными деньгами за странные лоты. Купил — выполняешь в реальности.</p>
      </header>

      {screen === 'setup' && (
        <section className="auction-panel card">
          <h2>Настройка вечера</h2>
          <div className="auction-choice">
            <span>Игроки</span>
            <div className="auction-pills">
              {PLAYER_COUNTS.map((count) => (
                <button key={count} className={count === playerCount ? 'is-active' : ''} onClick={() => setCount(count)} type="button">
                  {count}
                </button>
              ))}
            </div>
          </div>
          <div className="auction-choice">
            <span>Раунды</span>
            <div className="auction-pills">
              {ROUND_COUNTS.map((count) => (
                <button key={count} className={count === roundCount ? 'is-active' : ''} onClick={() => setRoundCount(count)} type="button">
                  {count}
                </button>
              ))}
            </div>
          </div>
          <div className="auction-names">
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
          <button className="auction-primary" type="button" onClick={startGame}>Начать торги</button>
        </section>
      )}

      {screen === 'auction' && currentLot && (
        <section className="auction-board card">
          <div className="auction-progress">Раунд {roundIndex + 1} из {lots.length}</div>
          <article className="auction-lot">
            <span>Лот #{roundIndex + 1}</span>
            <h2>{currentLot.title}</h2>
            <p>{currentLot.description}</p>
            <small>{currentLot.executor}</small>
          </article>

          <div className="auction-bidbox">
            <span>Текущая ставка</span>
            <strong>{currentBid || currentLot.startPrice} ₽</strong>
            <p>{leader ? `Лидер: ${leader.name}` : 'Пока никто не решился'}</p>
          </div>

          <div className="auction-players">
            {players.map((player) => (
              <div key={player.id} className={`auction-player ${player.id === leaderId ? 'is-leading' : ''}`}>
                <div>
                  <strong>{player.name}</strong>
                  <span>{player.balance} ₽</span>
                </div>
                <div className="auction-bid-actions">
                  {BID_STEPS.map((step) => {
                    const nextBid = getNextBid(currentBid, step, currentLot)
                    return (
                      <button key={step} type="button" disabled={nextBid > player.balance} onClick={() => placeBid(player, step)}>
                        +{step}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="auction-actions">
            <button className="auction-secondary" type="button" onClick={finishLot}>Пропустить лот</button>
            <button className="auction-primary" type="button" disabled={!leaderId} onClick={finishLot}>Продать лот</button>
          </div>
        </section>
      )}

      {screen === 'sold' && lastSale && (
        <section className="auction-panel card">
          <span className="auction-hero__eyebrow">лот закрыт</span>
          <h2>{lastSale.lot.title}</h2>
          {lastSale.winnerName ? (
            <p><b>{lastSale.winnerName}</b> забирает обязательство за {lastSale.price} ₽.</p>
          ) : (
            <p>Лот ушёл без ставки. Компания делает вид, что так и было задумано.</p>
          )}
          <button className="auction-primary" type="button" onClick={nextLot}>
            {roundIndex + 1 >= lots.length ? 'Показать итоги' : 'Следующий лот'}
          </button>
        </section>
      )}

      {screen === 'final' && (
        <section className="auction-panel card">
          <span className="auction-hero__eyebrow">итоги торгов</span>
          <h2>Кто ушёл богаче, а кто с обязательствами</h2>
          <div className="auction-scoreboard">
            {sortedPlayers.map((player, index) => (
              <div key={player.id}>
                <span>{index + 1}</span>
                <strong>{player.name}</strong>
                <em>{player.balance} ₽ · лотов: {player.wins}</em>
              </div>
            ))}
          </div>
          <button className="auction-primary" type="button" onClick={resetGame}>Сыграть ещё раз</button>
        </section>
      )}
    </div>
  )
}

export default RidiculousAuctionGame
