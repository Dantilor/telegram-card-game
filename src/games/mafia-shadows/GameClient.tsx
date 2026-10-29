import { useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Check, ChevronRight, Clock3, Copy, Crosshair, Crown, Eye, EyeOff, HeartPulse, LogOut, Moon,
  Search, Share2, ShieldCheck, Sparkles, User, Users, Volume2, VolumeX,
} from 'lucide-react'
import { useBack } from '../../hooks/useBack'
import { usePremium } from '../../contexts/PremiumContext'
import HomeButton from '../../components/HomeButton'
import BackButton from '../../components/BackButton'
import PremiumOverlay from '../../components/PremiumOverlay'
import { getApiBaseUrl } from '../../api/client'
import { trackEvent } from '../../lib/analytics'
import { getInitData } from '../../lib/telegram'
import { CITY_EVENTS, MAX_PLAYERS, MIN_PLAYERS, PHASE_TITLES, ROLE_META, type CityEventKey, type Phase, type Role, type Team } from './mafia'

type Session = { code: string; token: string; hostToken?: string }
type Player = { id: string; name: string; avatar: number; alive: boolean; isHost: boolean; ready: boolean; role: Role | null; team: Team | null }
type State = {
  room: { code: string; phase: Phase; round: number; phaseEndsAt: number | null; eventKey: CityEventKey; publicMessage: string; winner: Team | null }
  self: { id: string; name: string; avatar: number; alive: boolean; role: Role | null; team: Team | null; revealed: boolean; privateNote: string; hasActed: boolean; isHost: boolean }
  players: Player[]
  progress: { completed: number; required: number }
  events: Array<{ id: number; round: number; message: string }>
}

const API = `${getApiBaseUrl()}/api/games/mafia-shadows`
const avatarColors = ['violet', 'cyan', 'rose', 'amber', 'emerald', 'blue', 'fuchsia', 'orange']
const winnerText: Record<Team, [string, string, string]> = {
  city: ['ГОРОД ВЫСТОЯЛ', 'Победа города', 'Все Тени разоблачены. На улицах снова зажигается свет.'],
  mafia: ['ТЕНИ У ВЛАСТИ', 'Победа мафии', 'Последние голоса стихли. Теперь город принадлежит мафии.'],
  neutral: ['ПОСЛЕДНИЙ В ЖИВЫХ', 'Победа Одиночки', 'Он играл против всех — и дождался полной тишины.'],
}

let pushToast: (message: string) => void = () => undefined

function toastError(message: string) { pushToast(message) }
function toastSuccess(message: string) { pushToast(message) }

function haptic(style: 'light' | 'medium' | 'heavy' = 'light') {
  window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.(style)
  if (!window.Telegram?.WebApp?.HapticFeedback && navigator.vibrate) navigator.vibrate(style === 'heavy' ? 45 : style === 'medium' ? 25 : 12)
}

function initDataHeader(): Record<string, string> {
  const initData = getInitData()
  return initData ? { 'x-telegram-init-data': initData } : {}
}

function useAudio(enabled: boolean) {
  const context = useRef<AudioContext | null>(null)
  const ambient = useRef<OscillatorNode[]>([])
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const unlock = useCallback(async (force = false) => {
    if (!enabledRef.current && !force) return
    context.current ??= new AudioContext()
    if (context.current.state === 'suspended') await context.current.resume()
    if (ambient.current.length === 0) {
      const gain = context.current.createGain()
      const filter = context.current.createBiquadFilter()
      gain.gain.value = 0.05
      filter.type = 'lowpass'
      filter.frequency.value = 240
      gain.connect(filter).connect(context.current.destination)
      const nodes: OscillatorNode[] = []
      for (const [frequency, type] of [[55, 'sine'], [82, 'triangle'], [110, 'sine']] as const) {
        const oscillator = context.current.createOscillator()
        oscillator.type = type
        oscillator.frequency.value = frequency
        oscillator.connect(gain)
        oscillator.start()
        nodes.push(oscillator)
      }
      ambient.current = nodes
    }
  }, [])
  const cue = useCallback(async (kind: 'tap' | 'phase' | 'danger' | 'success', force = false) => {
    if (!enabledRef.current && !force) return
    await unlock(force)
    if (!context.current) return
    const frequencies = { tap: 320, phase: 180, danger: 92, success: 520 }
    const duration = kind === 'tap' ? 0.07 : 0.35
    const oscillator = context.current.createOscillator()
    const gain = context.current.createGain()
    oscillator.type = kind === 'danger' ? 'sawtooth' : 'sine'
    oscillator.frequency.value = frequencies[kind]
    gain.gain.setValueAtTime(kind === 'tap' ? 0.08 : 0.12, context.current.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.current.currentTime + duration)
    oscillator.connect(gain).connect(context.current.destination)
    oscillator.start()
    oscillator.stop(context.current.currentTime + duration)
  }, [unlock])
  useEffect(() => {
    if (!context.current) return
    void (enabled ? context.current.resume() : context.current.suspend()).catch(() => undefined)
  }, [enabled])
  useEffect(() => () => {
    for (const node of ambient.current) {
      try { node.stop() } catch { /* already stopped */ }
    }
    ambient.current = []
    const current = context.current
    context.current = null
    if (current && current.state !== 'closed') void current.close()
  }, [])
  return { unlock, cue }
}

async function post(payload: Record<string, unknown>) {
  const response = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...initDataHeader() },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })
  const result = await response.json() as Record<string, unknown> & { error?: string }
  if (!response.ok) throw new Error(result.error || 'Не удалось выполнить действие.')
  return result
}

function saveSession(session: Session) {
  localStorage.setItem(`gnh_mafia_shadows_${session.code}`, JSON.stringify(session))
  localStorage.setItem('gnh_mafia_shadows_last', session.code)
}
function readSession(code: string) {
  try {
    const value = localStorage.getItem(`gnh_mafia_shadows_${code}`)
    return value ? JSON.parse(value) as Session : null
  } catch {
    return null
  }
}
function scrollAppTop() {
  document.querySelector('.app')?.scrollTo({ top: 0, behavior: 'auto' })
}

function Button({ className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={className} {...props}>{children}</button>
}
function Switch({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-slot="switch"
      data-state={checked ? 'checked' : 'unchecked'}
      className="ms-switch"
      onClick={() => onCheckedChange(!checked)}
    />
  )
}
function Progress({ value }: { value: number }) {
  const width = `${Math.max(0, Math.min(100, value))}%`
  return (
    <div data-slot="progress">
      <span data-slot="progress-indicator" style={{ width }} />
    </div>
  )
}
function RoleIcon({ role, size = 25 }: { role: Role | null; size?: number }) {
  const p = { size, strokeWidth: 1.7 }
  if (role === 'don') return <Crown {...p} />
  if (role === 'mafia') return <Moon {...p} />
  if (role === 'detective') return <Search {...p} />
  if (role === 'doctor') return <HeartPulse {...p} />
  if (role === 'maniac') return <Crosshair {...p} />
  return <User {...p} />
}
function Avatar({ player }: { player: Player }) {
  return <span className={`avatar avatar-${avatarColors[player.avatar % 8]} ${player.alive ? '' : 'dead'}`}>{player.name.slice(0, 1).toLocaleUpperCase('ru')}</span>
}
function Countdown({ endsAt }: { endsAt: number | null }) {
  const [left, setLeft] = useState(0)
  useEffect(() => {
    const tick = () => setLeft(endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)) : 0)
    tick()
    const id = window.setInterval(tick, 500)
    return () => window.clearInterval(id)
  }, [endsAt])
  if (!endsAt) return null
  return <span className="timer" title="Ориентир. Фазу закрывает ведущий."><Clock3 size={15} />{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}<small>ориентир</small></span>
}
function Players({ players, selected, choose, disabled = [] }: { players: Player[]; selected?: string | null; choose?: (id: string) => void; disabled?: string[] }) {
  return <div className="players">{players.map((player) => {
    const content = <>
      <Avatar player={player} />
      <span className="player-name">
        <strong>{player.name}</strong>
        <small>{!player.alive ? (player.role ? ROLE_META[player.role].title : 'Выбыл') : player.role ? ROLE_META[player.role].title : player.isHost ? 'Создатель' : 'В игре'}</small>
      </span>
      {player.ready && <Check className="ready" size={17} />}
      {selected === player.id && <span className="selected"><Check size={14} /></span>}
    </>
    return choose
      ? <button type="button" key={player.id} className={`player ${selected === player.id ? 'active' : ''}`} disabled={!player.alive || disabled.includes(player.id)} onClick={() => choose(player.id)}>{content}</button>
      : <div key={player.id} className={`player ${player.alive ? '' : 'out'}`}>{content}</div>
  })}</div>
}
function Instruction({ tone, icon, title, children }: { tone: string; icon: ReactNode; title: string; children: ReactNode }) {
  return <section className={`instruction ${tone}`}><span className="instruction-icon">{icon}</span><div><small>ЧТО ДЕЛАТЬ СЕЙЧАС</small><strong>{title}</strong><p>{children}</p></div></section>
}

function Landing({
  initialCode, sound, setSound, onJoin, unlock,
}: {
  initialCode: string
  sound: boolean
  setSound: (value: boolean) => void
  onJoin: (session: Session) => void
  unlock: () => Promise<void>
}) {
  const handleBack = useBack('/games')
  const { isPremium } = usePremium()
  const [premiumOpen, setPremiumOpen] = useState(false)
  const [mode, setMode] = useState<'create' | 'join'>(initialCode ? 'join' : 'create')
  const [name, setName] = useState('')
  const [code, setCode] = useState(initialCode)
  const [busy, setBusy] = useState(false)
  const [, setSearchParams] = useSearchParams()

  const submit = async () => {
    if (mode === 'create' && !isPremium) {
      haptic()
      setPremiumOpen(true)
      return
    }
    try {
      setBusy(true)
      await unlock().catch(() => undefined)
      haptic('medium')
      const result = await post(mode === 'create' ? { action: 'create', name } : { action: 'join', name, code })
      const session = {
        code: String(result.code),
        token: String(result.token),
        ...(result.hostToken ? { hostToken: String(result.hostToken) } : {}),
      }
      saveSession(session)
      setSearchParams({ room: session.code })
      trackEvent(mode === 'create' ? 'mafia_shadows_create' : 'mafia_shadows_join', { gameId: 'mafia-shadows' })
      onJoin(session)
    } catch (error) {
      haptic('heavy')
      toastError(error instanceof Error ? error.message : 'Не удалось подключиться')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="landing">
      <div className="hero" />
      <div className="shade" />
      <div className="landing-inner">
        <div className="game-page ms-nav">
          <div className="game-page__top">
            <HomeButton className="game-page__nav-btn" />
            <BackButton className="game-page__nav-btn" onClick={handleBack} />
          </div>
        </div>
        <header className="top">
          <span className="brand"><Sparkles size={16} />GameNight Host</span>
          <label className="sound">{sound ? <Volume2 size={18} /> : <VolumeX size={18} />}<Switch checked={sound} onCheckedChange={setSound} /></label>
        </header>
        <section className="game-title">
          <small>СОЦИАЛЬНАЯ ИГРА · 4–14 ИГРОКОВ</small>
          <h1>МАФИЯ</h1>
          <strong>ТЕНИ ГОРОДА</strong>
          <p>У каждого — своя роль, свой телефон и причина вам лгать.</p>
        </section>
        <section className="entry">
          <div className="tabs" role="tablist">
            <button className={mode === 'create' ? 'active' : ''} onClick={() => setMode('create')}>Создать</button>
            <button className={mode === 'join' ? 'active' : ''} onClick={() => setMode('join')}>Войти по коду</button>
          </div>
          {mode === 'join' && (
            <label>
              <span>Код комнаты</span>
              <input
                className="game-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </label>
          )}
          <label>
            <span>Как вас называть?</span>
            <input className="game-input" placeholder="Например, Даниил" maxLength={18} value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void submit() }} />
          </label>
          <Button
            className="primary"
            disabled={busy || (mode === 'join' && (name.trim().length < 2 || code.length !== 6)) || (mode === 'create' && isPremium && name.trim().length < 2)}
            onClick={() => void submit()}
          >
            {busy ? 'Подключаем…' : mode === 'create' ? (isPremium ? 'Создать комнату' : 'Создать комнату · Premium') : 'Войти в город'}
            <ChevronRight />
          </Button>
          <div className="facts">
            <span><Users />Каждый со своего телефона</span>
            <span><ShieldCheck />Роли живых и ночные ходы тайные</span>
            <span><Crosshair />Одиночка появляется с 5 игроков</span>
          </div>
        </section>
      </div>
      <PremiumOverlay isOpen={premiumOpen} onClose={() => setPremiumOpen(false)} />
    </main>
  )
}

function Header({ state, sound, setSound, leave }: { state: State; sound: boolean; setSound: (value: boolean) => void; leave: () => void }) {
  const handleBack = useBack('/games')
  const [exitOpen, setExitOpen] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(state.room.code)
    haptic()
    toastSuccess('Код скопирован')
  }
  return (
    <>
      <header className="room-header">
        <div className="game-page ms-nav"><div className="game-page__top"><HomeButton className="game-page__nav-btn" /><BackButton className="game-page__nav-btn" onClick={handleBack} /></div></div>
        <div className="room-header-row">
          <button className="icon-button" aria-label="Выйти" onClick={() => setExitOpen(true)}><LogOut /></button>
          <button className="room-code" onClick={() => void copy()}><span>КОМНАТА</span><strong>{state.room.code}</strong><Copy /></button>
          <label className="sound compact">{sound ? <Volume2 /> : <VolumeX />}<Switch checked={sound} onCheckedChange={setSound} /></label>
        </div>
      </header>
      {exitOpen && (
        <div className="ms-dialog" role="dialog" aria-modal="true">
          <div className="ms-dialog__card exit-dialog">
            <h2>Выйти из комнаты?</h2>
            <p>Игра останется активной. На этом телефоне вы сможете вернуться по той же ссылке.</p>
            <div className="ms-dialog__actions">
              <button type="button" onClick={() => setExitOpen(false)}>Остаться</button>
              <button type="button" onClick={leave}>Выйти</button>
            </div>
          </div>
        </div>
      )}
      <section className="phase">
        <div><small>{state.room.round ? `РАУНД ${state.room.round}` : 'ПОДГОТОВКА'}</small><h1>{PHASE_TITLES[state.room.phase]}</h1></div>
        <Countdown endsAt={state.room.phaseEndsAt} />
        {state.progress.required > 0 && (
          <div className="progress">
            <Progress value={state.progress.completed / state.progress.required * 100} />
            <span>{state.progress.completed}/{state.progress.required} готовы</span>
          </div>
        )}
      </section>
    </>
  )
}

function HostBar({ state, label, action, disabled = false, act }: { state: State; label: string; action: string; disabled?: boolean; act: (action: string) => Promise<void> }) {
  return <div className="host-bar">{state.self.isHost ? <Button className="primary" disabled={disabled} onClick={() => void act(action)}>{label}<ChevronRight /></Button> : <div className="waiting"><i />Ждём создателя комнаты</div>}</div>
}

function Lobby({ state, act }: { state: State; act: (action: string) => Promise<void> }) {
  const missing = Math.max(0, MIN_PLAYERS - state.players.length)
  const share = async () => {
    const url = `${location.origin}${location.pathname}#/mafia-shadows?room=${state.room.code}`
    if (navigator.share) await navigator.share({ title: 'Мафия: Тени города', text: `Заходи в комнату ${state.room.code}`, url })
    else {
      await navigator.clipboard.writeText(url)
      toastSuccess('Ссылка скопирована')
    }
  }
  return (
    <>
      <Instruction tone="cyan" icon={<Users />} title="Подключите друзей по коду">Откройте ссылку на каждом телефоне. Когда все появятся в списке, создатель начнёт игру.</Instruction>
      <section className="share-card"><div><small>КОД ДЛЯ ВХОДА</small><strong>{state.room.code}</strong></div><Button onClick={() => void share()}><Share2 />Пригласить</Button></section>
      <section className="panel"><div className="section-head"><div><small>ГОРОД СОБИРАЕТСЯ</small><h2>Игроки</h2></div><span>{state.players.length}/{MAX_PLAYERS}</span></div><Players players={state.players} /></section>
      <section className="flow"><span><Moon />Тайный ход</span><ChevronRight /><span><Users />Обсуждение</span><ChevronRight /><span><ShieldCheck />Голосование</span></section>
      <HostBar state={state} label={missing ? `Нужно ещё ${missing}` : 'Раздать тайные роли'} action="start" disabled={missing > 0} act={act} />
    </>
  )
}

function Reveal({ state, act }: { state: State; act: (action: string) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const role = state.self.role
  const meta = role ? ROLE_META[role] : null
  const allies = state.players.filter((player) => player.id !== state.self.id && player.team === 'mafia' && state.self.team === 'mafia')
  return (
    <>
      <Instruction tone="violet" icon={<Eye />} title="Посмотрите роль тайно">Прикройте экран рукой. Соседи не должны увидеть вашу карту.</Instruction>
      <section className={`role-card ${open && meta ? `role-${meta.color}` : 'closed'}`}>
        {!open || !meta || !role ? (
          <>
            <div className="role-icon"><Moon /></div>
            <small>ЛИЧНОСТЬ ЗАСЕКРЕЧЕНА</small>
            <h2>Ваша роль внутри</h2>
            <p>Убедитесь, что никто не смотрит в экран.</p>
            <Button onClick={() => { setOpen(true); haptic('heavy') }}><Eye />Открыть роль</Button>
          </>
        ) : (
          <>
            <button className="hide" onClick={() => setOpen(false)}><EyeOff />Скрыть</button>
            <div className="role-icon"><RoleIcon role={role} size={42} /></div>
            <small>ВАША РОЛЬ</small>
            <h2>{meta.title}</h2>
            <p>{meta.short}</p>
            <div className="role-note"><strong>Цель</strong>{meta.goal}</div>
            {allies.length > 0 && <div className="role-note"><strong>Ваши союзники</strong>{allies.map((player) => player.name).join(', ')}</div>}
            {!state.self.revealed
              ? <Button onClick={() => void act('acknowledge')}><Check />Я запомнил роль</Button>
              : <span className="remembered"><Check />Роль запомнена</span>}
          </>
        )}
      </section>
      <HostBar state={state} label={`Город засыпает · ${state.progress.completed}/${state.progress.required}`} action="advance" disabled={state.progress.completed < state.progress.required} act={act} />
    </>
  )
}

function actionInfo(role: Role | null) {
  if (role === 'don' || role === 'mafia') return ['red', 'Выберите ночную жертву', 'Мафия голосует тайно. При равенстве решает Дон.', 'Подтвердить цель']
  if (role === 'detective') return ['cyan', 'Кого проверить?', 'После рассвета результат появится только у вас.', 'Проверить игрока']
  if (role === 'doctor') return ['green', 'Кого защитить?', 'Если на игрока нападут, он останется в игре.', 'Защитить игрока']
  if (role === 'maniac') return ['violet', 'Выберите свою цель', 'Ваш удар не связан с мафией. Вы играете против всех.', 'Сделать выбор']
  return ['blue', 'Наблюдайте за тишиной', 'Утром слушайте версии и ищите несостыковки.', '']
}

function Night({ state, act, selected, setSelected }: { state: State; act: (action: string, id?: string) => Promise<void>; selected: string | null; setSelected: (id: string | null) => void }) {
  const [tone, title, text, button] = actionInfo(state.self.role)
  const canAct = state.self.alive && ['don', 'mafia', 'detective', 'doctor', 'maniac'].includes(state.self.role ?? '')
  const disabled = state.self.role === 'doctor' ? [] : [state.self.id]
  if (state.self.team === 'mafia') disabled.push(...state.players.filter((player) => player.team === 'mafia').map((player) => player.id))
  return (
    <>
      <Instruction tone={tone} icon={<RoleIcon role={state.self.role} />} title={state.self.alive ? title : 'Вы наблюдаете за городом'}>{state.self.alive ? text : 'Вы выбыли. Следите за партией, но не выдавайте роли.'}</Instruction>
      {state.self.privateNote && state.self.role === 'detective' && <section className="clue"><Search /><div><small>ПОСЛЕДНЯЯ ПРОВЕРКА</small><strong>{state.self.privateNote}</strong></div></section>}
      {canAct ? (
        <section className="panel">
          <div className="section-head"><div><small>ТАЙНЫЙ ВЫБОР</small><h2>Жители города</h2></div>{state.self.hasActed && <span><Check />Ход принят</span>}</div>
          <Players players={state.players.filter((player) => player.alive)} choose={(id) => { setSelected(id); haptic() }} selected={selected} disabled={disabled} />
          <Button className={`primary action-${tone}`} disabled={!selected} onClick={() => selected && void act('turn', selected)}>{state.self.hasActed ? 'Изменить выбор' : button}<ChevronRight /></Button>
        </section>
      ) : (
        <section className="night-wait"><div><Moon /></div><strong>{state.self.alive ? 'Ваш ночной ход не требуется' : 'Вы теперь наблюдатель'}</strong><p>Экран обновится, когда создатель откроет утро.</p></section>
      )}
      <HostBar state={state} label={`Открыть утро · ${state.progress.completed}/${state.progress.required}`} action="advance" disabled={state.progress.completed < state.progress.required} act={act} />
    </>
  )
}

function Discussion({ state, act }: { state: State; act: (action: string) => Promise<void> }) {
  const event = CITY_EVENTS[state.room.eventKey]
  return (
    <>
      <section className="dawn"><small>СВОДКА С РАССВЕТА</small><h2>{state.room.publicMessage}</h2></section>
      <section className="event"><Sparkles /><div><small>СОБЫТИЕ РАУНДА</small><strong>{event.title}</strong><p>{event.text}</p></div></section>
      <Instruction tone="cyan" icon={<Users />} title="Обсудите подозрения вслух">Каждый живой игрок называет подозреваемого и одну причину. Голосование откроется, когда все живые подтвердят, что высказались.</Instruction>
      {state.self.alive && (
        state.self.hasActed
          ? <section className="panel"><span className="remembered"><Check />Вы высказались</span></section>
          : <Button className="primary" onClick={() => void act('acknowledge')}><Check />Я высказался</Button>
      )}
      {state.self.privateNote && state.self.role === 'detective' && <section className="clue"><Search /><div><small>ПОСЛЕДНЯЯ ПРОВЕРКА</small><strong>{state.self.privateNote}</strong></div></section>}
      <section className="panel"><div className="section-head"><div><small>КТО ЕЩЁ В ИГРЕ</small><h2>Жители</h2></div></div><Players players={state.players} /></section>
      <HostBar state={state} label={`Перейти к голосованию · ${state.progress.completed}/${state.progress.required}`} action="advance" disabled={state.progress.completed < state.progress.required} act={act} />
    </>
  )
}

function Vote({ state, act, selected, setSelected }: { state: State; act: (action: string, id?: string) => Promise<void>; selected: string | null; setSelected: (id: string | null) => void }) {
  return (
    <>
      <Instruction tone="red" icon={<ShieldCheck />} title={state.self.alive ? 'Выберите того, кто лжёт' : 'Наблюдайте за решением города'}>{state.self.alive ? 'Голос тайный. До подведения итога его можно изменить.' : 'Выбывшие игроки не голосуют и не подсказывают живым.'}</Instruction>
      {state.self.privateNote && state.self.role === 'detective' && <section className="clue"><Search /><div><small>ПОСЛЕДНЯЯ ПРОВЕРКА</small><strong>{state.self.privateNote}</strong></div></section>}
      {state.self.alive && (
        <section className="panel">
          <div className="section-head"><div><small>ТАЙНОЕ ГОЛОСОВАНИЕ</small><h2>Кого изгнать?</h2></div>{state.self.hasActed && <span><Check />Голос принят</span>}</div>
          <Players players={state.players.filter((player) => player.alive)} choose={(id) => { setSelected(id); haptic() }} selected={selected} disabled={[state.self.id]} />
          <Button className="primary action-red" disabled={!selected} onClick={() => selected && void act('turn', selected)}>{state.self.hasActed ? 'Изменить голос' : 'Отдать голос'}<ShieldCheck /></Button>
        </section>
      )}
      <HostBar state={state} label={`Подвести итог · ${state.progress.completed}/${state.progress.required}`} action="advance" disabled={state.progress.completed < state.progress.required} act={act} />
    </>
  )
}

function Finished({ state, act }: { state: State; act: (action: string) => Promise<void> }) {
  const winner = state.room.winner
  const [eyebrow, title, text] = winner ? winnerText[winner] : ['ГОРОД ЗАМОЛЧАЛ', 'Последним не остался никто', state.room.publicMessage]
  return (
    <>
      <section className={`winner winner-${winner ?? 'city'}`}><div><Crown /></div><small>{eyebrow}</small><h1>{title}</h1><p>{text}</p></section>
      <section className="panel"><div className="section-head"><div><small>ВСЕ МАСКИ СНЯТЫ</small><h2>Роли игроков</h2></div></div><Players players={state.players} /></section>
      {state.events.length > 0 && <section className="timeline"><small>ХРОНИКА ГОРОДА</small>{state.events.map((event) => <div key={event.id}><span>{event.round}</span><p>{event.message}</p></div>)}</section>}
      <HostBar state={state} label="Сыграть ещё раз" action="restart" act={act} />
    </>
  )
}

function Room({ session, state, refresh, sound, setSound, audio, leave }: {
  session: Session
  state: State
  refresh: () => Promise<void>
  sound: boolean
  setSound: (value: boolean) => void
  audio: ReturnType<typeof useAudio>
  leave: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  useEffect(() => {
    setSelected(null)
    scrollAppTop()
  }, [state.room.phase, state.room.round])
  const act = async (action: string, id?: string) => {
    try {
      setBusy(true)
      await audio.cue(action === 'turn' ? 'tap' : action === 'advance' ? 'phase' : 'success').catch(() => undefined)
      haptic(action === 'advance' ? 'heavy' : 'medium')
      await post({ action, ...session, targetId: id })
      if (action === 'start') trackEvent('mafia_shadows_start', { gameId: 'mafia-shadows' })
      await refresh()
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Действие не выполнено')
    } finally {
      setBusy(false)
    }
  }
  let content: ReactNode
  if (state.room.phase === 'lobby') content = <Lobby state={state} act={act} />
  else if (state.room.phase === 'reveal') content = <Reveal state={state} act={act} />
  else if (state.room.phase === 'night') content = <Night state={state} act={act} selected={selected} setSelected={setSelected} />
  else if (state.room.phase === 'discussion') content = <Discussion state={state} act={act} />
  else if (state.room.phase === 'vote') content = <Vote state={state} act={act} selected={selected} setSelected={setSelected} />
  else content = <Finished state={state} act={act} />
  return <main className={`room phase-${state.room.phase}`} aria-busy={busy}><div className="room-bg" /><div className="room-inner"><Header state={state} sound={sound} setSound={setSound} leave={leave} /><div className="content">{content}</div></div>{busy && <div className="lock"><i /></div>}</main>
}

export function GameClient() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [ready, setReady] = useState(false)
  const [initialCode, setInitialCode] = useState('')
  const [session, setSession] = useState<Session | null>(null)
  const [state, setState] = useState<State | null>(null)
  const [loading, setLoading] = useState(false)
  const [sound, setSound] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const audio = useAudio(sound)
  const toggleSound = (value: boolean) => {
    setSound(value)
    if (value) void audio.cue('phase', true)
  }
  useEffect(() => {
    const root = document.querySelector('.mafia-shadows')
    if (!root || !sound) return
    const start = () => { void audio.unlock() }
    root.addEventListener('pointerdown', start)
    return () => root.removeEventListener('pointerdown', start)
  }, [sound, audio])
  const phase = useRef<Phase | null>(null)
  const finishedTracked = useRef(false)

  useEffect(() => {
    pushToast = (message) => {
      setToast(message)
      window.setTimeout(() => setToast((current) => current === message ? null : current), 2800)
    }
    return () => { pushToast = () => undefined }
  }, [])

  useEffect(() => {
    window.Telegram?.WebApp?.ready?.()
    window.Telegram?.WebApp?.expand?.()
    window.Telegram?.WebApp?.setHeaderColor?.('#070914')
    const fromLink = (searchParams.get('room') ?? '').replace(/\D/g, '').slice(0, 6)
    const last = localStorage.getItem('gnh_mafia_shadows_last') ?? ''
    const code = fromLink || ''
    setInitialCode(code)
    if (code) setSession(readSession(code))
    else if (last) setInitialCode(last)
    setReady(true)
  }, [searchParams])

  const refresh = useCallback(async () => {
    if (!session) return
    const query = new URLSearchParams({ code: session.code, token: session.token })
    if (session.hostToken) query.set('hostToken', session.hostToken)
    const response = await fetch(`${API}?${query}`, { cache: 'no-store', headers: initDataHeader() })
    const result = await response.json() as State & { error?: string }
    if (!response.ok) throw new Error(result.error || 'Связь с комнатой потеряна')
    setState(result)
  }, [session])

  useEffect(() => {
    if (!session) return
    setLoading(true)
    void refresh().catch((error) => toastError(error instanceof Error ? error.message : 'Комната недоступна')).finally(() => setLoading(false))
    const id = window.setInterval(() => void refresh().catch(() => undefined), 1600)
    return () => window.clearInterval(id)
  }, [session, refresh])

  useEffect(() => {
    if (!state || phase.current === state.room.phase) return
    if (phase.current) void audio.cue(state.room.phase === 'finished' ? 'success' : state.room.phase === 'night' ? 'danger' : 'phase').catch(() => undefined)
    if (state.room.phase === 'finished' && !finishedTracked.current) {
      finishedTracked.current = true
      trackEvent('mafia_shadows_finish', { gameId: 'mafia-shadows', winner: state.room.winner })
    }
    if (state.room.phase !== 'finished') finishedTracked.current = false
    phase.current = state.room.phase
  }, [state, audio.cue])

  const leave = () => {
    setSearchParams({})
    setSession(null)
    setState(null)
    setInitialCode('')
  }

  let content: ReactNode
  if (!ready) content = <div className="boot"><i /></div>
  else if (!session) content = <Landing initialCode={initialCode} sound={sound} setSound={toggleSound} onJoin={setSession} unlock={audio.unlock} />
  else if (loading && !state) content = <div className="boot"><i /><p>Входим в город…</p></div>
  else if (!state) content = <div className="boot"><Moon /><p>Комната не отвечает</p><Button onClick={() => void refresh()}>Попробовать снова</Button><Button onClick={leave}>Выйти</Button></div>
  else content = <Room session={session} state={state} refresh={refresh} sound={sound} setSound={toggleSound} audio={audio} leave={leave} />

  return <>{content}{toast && <div className="ms-toast" role="status">{toast}</div>}</>
}
