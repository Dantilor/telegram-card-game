import { useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BadgeCheck,
  Check,
  ChevronRight,
  CircleHelp,
  Copy,
  Eye,
  EyeOff,
  FileCheck2,
  Files,
  Fingerprint,
  IdCard,
  LogOut,
  MessageCircleQuestion,
  RotateCcw,
  ScanFace,
  Search,
  Share2,
  ShieldQuestion,
  Sparkles,
  UserRoundSearch,
  Users,
  Volume2,
  VolumeX,
  Vote as VoteIcon,
} from "lucide-react";
import { useBack } from "../../hooks/useBack";
import { usePremium } from "../../contexts/PremiumContext";
import HomeButton from "../../components/HomeButton";
import BackButton from "../../components/BackButton";
import PremiumOverlay from "../../components/PremiumOverlay";
import { getApiBaseUrl } from "../../api/client";
import { trackEvent } from "../../lib/analytics";
import { getInitData } from "../../lib/telegram";
import { MAX_PLAYERS, MIN_PLAYERS, PHASE_TITLES, type Archetype, type Phase } from "./doubles";

type Session = { code: string; token: string; hostToken?: string };
type Player = {
  id: string;
  name: string;
  avatar: number;
  isHost: boolean;
  ready: boolean;
  publicIdentity: string | null;
  archetype: Archetype | null;
  isOriginal: boolean | null;
  voteCount: number;
};
type Claimant = { id: string; name: string; avatar: number; identity: string };
type GameResult = {
  outcome: "original" | "duplicate" | "tie";
  selectedId: string | null;
  originalId: string | null;
  duplicateId: string | null;
  voteCounts: Record<string, number>;
  erased: { playerId: string; hiddenIdentity: string; guess: string | null; correct: boolean } | null;
  personal: { score: number; title: string; text: string };
};
type State = {
  room: {
    code: string;
    phase: Phase;
    phaseEndsAt: number | null;
    publicMessage: string;
    resultPlayerId: string | null;
    case: {
      number: string;
      name: string;
      targetTitle: string;
      targetSubtitle: string;
      intro: string;
      evidenceTitle: string | null;
      evidenceText: string | null;
      evidencePrompt: string | null;
    };
  };
  self: {
    id: string;
    name: string;
    avatar: number;
    archetype: Archetype | null;
    identityTitle: string | null;
    identitySubtitle: string | null;
    dossier: string[];
    secretTask: string;
    interrogationPrompt: string;
    echoes: string[];
    revealed: boolean;
    hasVoted: boolean;
    voteTargetId: string | null;
    identityGuess: string | null;
    hiddenIdentity: string | null;
    isOriginal: boolean | null;
    isHost: boolean;
  };
  players: Player[];
  claimants: Claimant[];
  identityOptions: string[];
  progress: { completed: number; required: number };
  result: GameResult | null;
};

const API = `${getApiBaseUrl()}/api/games/doubles`;
const avatarTones = ["cyan", "violet", "pink", "amber", "blue", "mint", "coral", "indigo", "gold", "plum"];
let pushToast: (message: string) => void = () => undefined;
const toast = {
  error: (message: string) => pushToast(message),
  success: (message: string) => pushToast(message),
};
function Button({ className = "", children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={className} {...props}>{children}</button>;
}
function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={className} {...props} />;
}
function Switch({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (value: boolean) => void }) {
  return <button type="button" role="switch" aria-checked={checked} data-checked={checked ? "" : undefined} className="dv-switch" onClick={() => onCheckedChange(!checked)} />;
}
function Progress({ value }: { value: number }) {
  const width = `${Math.max(0, Math.min(100, value))}%`;
  return <div data-slot="progress"><span data-slot="progress-indicator" style={{ width }} /></div>;
}

function haptic(style: "light" | "medium" | "heavy" = "light") {
  window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.(style);
  if (!window.Telegram?.WebApp?.HapticFeedback && navigator.vibrate) navigator.vibrate(style === "heavy" ? 45 : style === "medium" ? 24 : 12);
}

function useAudio(enabled: boolean) {
  const context = useRef<AudioContext | null>(null);
  const ambientNodes = useRef<OscillatorNode[]>([]);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const unlock = useCallback(async (force = false) => {
    if (!enabledRef.current && !force) return;
    context.current ??= new AudioContext();
    if (context.current.state === "suspended") await context.current.resume();
    if (ambientNodes.current.length === 0) {
      const gain = context.current.createGain();
      const filter = context.current.createBiquadFilter();
      gain.gain.value = 0.07;
      filter.type = "lowpass";
      filter.frequency.value = 260;
      gain.connect(filter).connect(context.current.destination);
      const nodes: OscillatorNode[] = [];
      for (const [frequency, type] of [[82, "sine"], [123, "triangle"]] as const) {
        const oscillator = context.current.createOscillator();
        oscillator.type = type;
        oscillator.frequency.value = frequency;
        oscillator.connect(gain);
        oscillator.start();
        nodes.push(oscillator);
      }
      ambientNodes.current = nodes;
    }
  }, []);

  const cue = useCallback(async (kind: "tap" | "paper" | "phase" | "reveal" | "success", force = false) => {
    if (!enabledRef.current && !force) return;
    await unlock(force);
    if (!context.current) return;
    const notes: Record<typeof kind, number[]> = {
      tap: [360],
      paper: [190, 240],
      phase: [180, 270, 405],
      reveal: [120, 240, 480],
      success: [330, 440, 660],
    };
    notes[kind].forEach((frequency, index) => {
      const oscillator = context.current!.createOscillator();
      const gain = context.current!.createGain();
      const start = context.current!.currentTime + index * 0.075;
      oscillator.type = kind === "paper" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(kind === "tap" ? 0.12 : 0.18, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + (kind === "tap" ? 0.08 : 0.32));
      oscillator.connect(gain).connect(context.current!.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.36);
    });
  }, [unlock]);

  useEffect(() => {
    if (!context.current) return;
    void (enabled ? context.current.resume() : context.current.suspend()).catch(() => undefined);
  }, [enabled]);

  useEffect(() => () => {
    for (const node of ambientNodes.current) {
      try { node.stop(); } catch { /* already stopped */ }
    }
    ambientNodes.current = [];
    const current = context.current;
    context.current = null;
    if (current && current.state !== "closed") void current.close();
  }, []);

  return { unlock, cue };
}

function initDataHeader(): Record<string, string> {
  const initData = getInitData();
  return initData ? { "x-telegram-init-data": initData } : {};
}
async function post(payload: Record<string, unknown>) {
  const response = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...initDataHeader() },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const result = await response.json() as Record<string, unknown> & { error?: string };
  if (!response.ok) throw new Error(result.error || "Не удалось выполнить действие.");
  return result;
}

function saveSession(session: Session) {
  localStorage.setItem(`gnh_doubles_${session.code}`, JSON.stringify(session));
  localStorage.setItem("gnh_doubles_last", session.code);
}
function scrollAppTop() {
  document.querySelector(".app")?.scrollTo({ top: 0, behavior: "auto" });
}

function readSession(code: string) {
  try {
    const value = localStorage.getItem(`gnh_doubles_${code}`);
    return value ? JSON.parse(value) as Session : null;
  } catch {
    return null;
  }
}

function Avatar({ name, avatar, size = "normal" }: { name: string; avatar: number; size?: "normal" | "large" }) {
  return <span className={`avatar avatar-${avatarTones[avatar % avatarTones.length]} ${size === "large" ? "avatar-large" : ""}`}>{name.slice(0, 1).toLocaleUpperCase("ru")}</span>;
}

function Countdown({ endsAt }: { endsAt: number | null }) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    const tick = () => setLeft(endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)) : 0);
    tick();
    const interval = window.setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [endsAt]);
  if (!endsAt) return null;
  return <span className="timer">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span>;
}

function Instruction({ tone = "cyan", icon, title, children }: { tone?: string; icon: ReactNode; title: string; children: ReactNode }) {
  return <section className={`instruction instruction-${tone}`}><span className="instruction-icon">{icon}</span><div><small>ЧТО ДЕЛАТЬ СЕЙЧАС</small><strong>{title}</strong><p>{children}</p></div></section>;
}

function SoundToggle({ sound, setSound, compact = false }: { sound: boolean; setSound: (value: boolean) => void; compact?: boolean }) {
  return <label className={`sound-toggle ${compact ? "sound-compact" : ""}`} aria-label="Звук игры">{sound ? <Volume2 /> : <VolumeX />}<Switch checked={sound} onCheckedChange={setSound} /></label>;
}

function Landing({ initialCode, sound, setSound, onJoin, unlock }: { initialCode: string; sound: boolean; setSound: (value: boolean) => void; onJoin: (session: Session) => void; unlock: () => Promise<void> }) {
  const handleBack = useBack("/games");
  const { isPremium } = usePremium();
  const [, setSearchParams] = useSearchParams();
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "join">(initialCode ? "join" : "create");
  const [name, setName] = useState("");
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (mode === "create" && !isPremium) {
      haptic();
      setPremiumOpen(true);
      return;
    }
    try {
      setBusy(true);
      await unlock().catch(() => undefined);
      haptic("medium");
      const result = await post(mode === "create" ? { action: "create", name } : { action: "join", name, code });
      const session: Session = {
        code: String(result.code),
        token: String(result.token),
        ...(result.hostToken ? { hostToken: String(result.hostToken) } : {}),
      };
      saveSession(session);
      setSearchParams({ room: session.code });
      trackEvent(mode === "create" ? "doubles_create" : "doubles_join", { gameId: "doubles" });
      onJoin(session);
    } catch (error) {
      haptic("heavy");
      toast.error(error instanceof Error ? error.message : "Не удалось подключиться");
    } finally {
      setBusy(false);
    }
  };

  return <main className="landing">
    <div className="landing-art" aria-hidden="true"><img src={`${import.meta.env.BASE_URL}games/doubles/dvoiniki-keyart.webp`} alt="" fetchPriority="high" /></div>
    <div className="landing-shade" />
    <div className="landing-inner">
      <div className="game-page dv-nav">
        <div className="game-page__top">
          <HomeButton className="game-page__nav-btn" />
          <BackButton className="game-page__nav-btn" onClick={handleBack} />
        </div>
      </div>
      <header className="landing-top"><span className="brand"><Sparkles />GameNight Host</span><SoundToggle sound={sound} setSound={setSound} /></header>
      <section className="game-title">
        <span className="case-chip"><Fingerprint />СОЦИАЛЬНАЯ ИГРА · 4–12 ИГРОКОВ</span>
        <h1>ДВОЙНИКИ</h1>
        <strong>ЧУЖАЯ ПАМЯТЬ. ОДНО НАСТОЯЩЕЕ ИМЯ.</strong>
        <p>Докажите, что ваша жизнь принадлежит именно вам — пока кто-то собирает личность по обрывкам разговоров.</p>
      </section>
      <section className="entry-card">
        <div className="mode-tabs" role="tablist" aria-label="Способ входа">
          <button type="button" role="tab" aria-selected={mode === "create"} className={mode === "create" ? "active" : ""} onClick={() => setMode("create")}>Создать</button>
          <button type="button" role="tab" aria-selected={mode === "join"} className={mode === "join" ? "active" : ""} onClick={() => setMode("join")}>Войти по коду</button>
        </div>
        {mode === "join" && <label className="field"><span>Код комнаты</span><Input className="game-input" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} /></label>}
        <label className="field"><span>Как вас называть?</span><Input className="game-input" placeholder="Например, Даниил" maxLength={18} value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void submit(); }} /></label>
        <Button className="primary-button" disabled={busy || (mode === "join" && (name.trim().length < 2 || code.length !== 6)) || (mode === "create" && isPremium && name.trim().length < 2)} onClick={() => void submit()}>{busy ? "Открываем архив…" : mode === "create" ? (isPremium ? "Создать комнату" : "Создать комнату · Premium") : "Войти в расследование"}<ChevronRight /></Button>
        <div className="landing-facts"><span><Users />Каждый играет со своего телефона</span></div>
      </section>
    </div>
    <PremiumOverlay isOpen={premiumOpen} onClose={() => setPremiumOpen(false)} />
  </main>;
}

function RoomHeader({ state, sound, setSound, leave }: { state: State; sound: boolean; setSound: (value: boolean) => void; leave: () => void }) {
  const [exitOpen, setExitOpen] = useState(false);
  const copyCode = async () => {
    await navigator.clipboard.writeText(state.room.code);
    haptic();
    toast.success("Код комнаты скопирован");
  };

  const handleBack = useBack("/games");
  return <>
    <header className="room-header">
      <div className="game-page dv-nav"><div className="game-page__top"><HomeButton className="game-page__nav-btn" /><BackButton className="game-page__nav-btn" onClick={handleBack} /></div></div>
      <div className="room-header-row">
      <button className="icon-button" aria-label="Выйти из комнаты" onClick={() => setExitOpen(true)}><LogOut /></button>
      <button className="room-code" onClick={() => void copyCode()}><span>КОМНАТА</span><strong>{state.room.code}</strong><Copy /></button>
      <SoundToggle sound={sound} setSound={setSound} compact />
      </div>
    </header>
    {exitOpen && <div className="dv-dialog" role="dialog" aria-modal="true"><div className="exit-dialog"><h2>Выйти из комнаты?</h2><p>Партия продолжится. По этой же ссылке вы сможете вернуться на своём телефоне.</p><div className="dv-dialog__actions"><button type="button" onClick={() => setExitOpen(false)}>Остаться</button><button type="button" onClick={leave}>Выйти</button></div></div></div>}
    <section className="phase-card">
      <div><small>{state.room.phase === "lobby" ? "АРХИВ ЗАКРЫТ" : `ДЕЛО № ${state.room.case.number} · ${state.room.case.name}`}</small><h1>{PHASE_TITLES[state.room.phase]}</h1></div>
      <Countdown endsAt={state.room.phaseEndsAt} />
      {state.progress.required > 0 && <div className="phase-progress"><Progress value={(state.progress.completed / state.progress.required) * 100} /><span>{state.progress.completed}/{state.progress.required} готовы</span></div>}
    </section>
  </>;
}

function HostBar({ state, label, action, disabled = false, act }: { state: State; label: string; action: string; disabled?: boolean; act: (action: string) => Promise<void> }) {
  return <div className="host-bar">{state.self.isHost
    ? <Button className="primary-button" disabled={disabled} onClick={() => void act(action)}>{label}{action === "restart" ? <RotateCcw /> : <ChevronRight />}</Button>
    : <div className="waiting"><i />Ждём создателя комнаты</div>}
  </div>;
}

function PlayerList({ players, identities = false }: { players: Player[]; identities?: boolean }) {
  return <div className="player-list">{players.map((player) => <div className="player-row" key={player.id}>
    <Avatar name={player.name} avatar={player.avatar} />
    <span><strong>{player.name}</strong><small>{identities ? player.publicIdentity || "Досье закрыто" : player.isHost ? "Создатель комнаты" : "Подключён"}</small></span>
    {player.ready && <i className="ready-mark"><Check /></i>}
  </div>)}</div>;
}

function Lobby({ state, act }: { state: State; act: (action: string) => Promise<void> }) {
  const missing = Math.max(0, MIN_PLAYERS - state.players.length);
  const share = async () => {
    const url = `${location.origin}${location.pathname}#/doubles?room=${state.room.code}`;
    if (navigator.share) await navigator.share({ title: "Двойники", text: `Заходи в комнату ${state.room.code}. Здесь кому-то выдали твою жизнь.`, url });
    else {
      await navigator.clipboard.writeText(url);
      toast.success("Ссылка скопирована");
    }
  };

  return <>
    <Instruction icon={<Users />} title="Подключите друзей по коду">Откройте ссылку на каждом телефоне. Когда все появятся в списке, создатель раздаст тайные досье.</Instruction>
    <section className="share-card"><div><small>КОД ДЛЯ ВХОДА</small><strong>{state.room.code}</strong></div><Button className="invite-button" onClick={() => void share()}><Share2 />Пригласить</Button></section>
    <section className="panel"><div className="section-head"><div><small>УЧАСТНИКИ ДЕЛА</small><h2>Игроки</h2></div><span>{state.players.length}/{MAX_PLAYERS}</span></div><PlayerList players={state.players} /></section>
    <section className="rules-strip"><span><IdCard />Получите личность</span><ChevronRight /><span><MessageCircleQuestion />Защитите историю</span><ChevronRight /><span><VoteIcon />Найдите оригинал</span></section>
    <HostBar state={state} label={missing ? `Нужно ещё игроков: ${missing}` : "Раздать тайные досье"} action="start" disabled={missing > 0} act={act} />
  </>;
}

function EchoTrail({ echoes }: { echoes: string[] }) {
  if (!echoes.length) return null;
  return <section className="echo-card"><div className="section-head"><div><small>ЭХА ПАМЯТИ</small><h2>Что возвращается</h2></div><span>{echoes.length}/3</span></div><div className="echo-list">{echoes.map((echo, index) => <div key={echo}><i>{index + 1}</i><p>{echo}</p></div>)}</div></section>;
}

function Reveal({ state, act, cue }: { state: State; act: (action: string) => Promise<void>; cue: (kind: "paper" | "reveal") => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const erased = state.self.archetype === "erased";
  const claimant = state.self.archetype === "claimant";

  return <>
    <Instruction tone="violet" icon={<Eye />} title="Откройте досье тайно">Прикройте экран рукой. Не показывайте соседям свои воспоминания и личную цель.</Instruction>
    <section className={`dossier-card ${open ? "dossier-open" : "dossier-closed"} ${erased ? "dossier-erased" : ""}`}>
      {!open ? <>
        <div className="closed-seal"><Fingerprint /></div><small>КОНФИДЕНЦИАЛЬНО</small><h2>Ваша личность внутри</h2><p>Сейчас вы узнаете, кем были до того, как архив раскололся.</p>
        <Button onClick={() => { setOpen(true); haptic("heavy"); void cue("reveal"); }}><Eye />Открыть досье</Button>
      </> : <>
        <button className="hide-card" onClick={() => { setOpen(false); void cue("paper"); }}><EyeOff />Скрыть</button>
        <div className="identity-mark">{erased ? <UserRoundSearch /> : claimant ? <ScanFace /> : <IdCard />}</div>
        <small>{erased ? "ЗАПИСЬ ПОВРЕЖДЕНА" : claimant ? "ВЫ УВЕРЕНЫ: ЭТО ВЫ" : "ВАША ЛИЧНОСТЬ"}</small>
        <h2>{erased ? "Личность не установлена" : state.self.identityTitle}</h2>
        <p className="identity-subtitle">{erased ? "Имя, профессия и прошлое стёрты" : state.self.identitySubtitle}</p>
        {erased ? <>
          <div className="goal-note"><strong>Ваша цель</strong><p>Слушайте чужие представления и детали биографий. К финальному голосованию выберите, чья личность на самом деле принадлежит вам.</p></div>
          <EchoTrail echoes={state.self.echoes} />
        </> : <>
          <div className="memory-block"><strong>Фрагменты вашей памяти</strong>{state.self.dossier.map((memory, index) => <div key={memory}><i>{String(index + 1).padStart(2, "0")}</i><p>{memory}</p></div>)}</div>
          <div className="goal-note"><strong>Ваша цель</strong><p>{claimant ? "У другого игрока будет то же имя. Докажите, что настоящая история — именно ваша. Вы сами не знаете, оригинал вы или двойник." : "Представьтесь, поделитесь только одним наблюдением и помогите вычислить настоящего владельца спорной личности."}</p></div>
        </>}
        <div className="secret-note"><Sparkles /><div><strong>Тайная задача</strong><p>{state.self.secretTask}</p></div></div>
        {!state.self.revealed ? <Button onClick={() => void act("acknowledge")}><Check />Я запомнил досье</Button> : <span className="remembered"><BadgeCheck />Досье запомнено</span>}
      </>}
    </section>
    <HostBar state={state} label={`Начать показания · ${state.progress.completed}/${state.progress.required}`} action="advance" disabled={state.progress.completed < state.progress.required} act={act} />
  </>;
}

function IdentitySummary({ state }: { state: State }) {
  const erased = state.self.archetype === "erased";
  return <section className={`self-summary ${erased ? "self-erased" : ""}`}><div className="self-summary-icon">{erased ? <ShieldQuestion /> : <IdCard />}</div><div><small>ВАША ПОЗИЦИЯ</small><strong>{erased ? "Личность не установлена" : state.self.identityTitle}</strong><p>{erased ? "Не раскрывайте первую догадку. Собирайте совпадения." : state.self.identitySubtitle}</p></div></section>;
}

function Testimony({ state, act }: { state: State; act: (action: string) => Promise<void> }) {
  const erased = state.self.archetype === "erased";
  const claimant = state.self.archetype === "claimant";
  return <>
    <Instruction icon={<MessageCircleQuestion />} title={erased ? "Скажите, что память стёрта" : "Представьтесь по очереди"}>{erased ? "Не выдумывайте имя. Скажите: «Я помню только фрагменты» — и прочитайте вслух одно эхо." : claimant ? "На каждого около 45 секунд. Назовите имя, профессию и две детали из памяти. Не читайте карточку слово в слово." : "На каждого около 45 секунд. Назовите свою личность и одно наблюдение. Остальные детали пока оставьте при себе."}</Instruction>
    <IdentitySummary state={state} />
    {erased && <EchoTrail echoes={state.self.echoes} />}
    <section className="panel"><div className="section-head"><div><small>ПОРЯДОК ПОКАЗАНИЙ</small><h2>Кто говорит дальше</h2></div></div><PlayerList players={state.players} /></section>
    <section className="micro-rule"><CircleHelp /><p><strong>Главное правило:</strong> можно убеждать, играть и приукрашивать. Нельзя показывать соседям экран или зачитывать досье целиком.</p></section>
    <HostBar state={state} label="Начать перекрёстный допрос" action="advance" act={act} />
  </>;
}

function Interrogation({ state, act }: { state: State; act: (action: string) => Promise<void> }) {
  return <>
    <Instruction tone="pink" icon={<Search />} title="Ищите несовпадения, а не эмоции">Каждый задаёт свой вопрос вслух. Сначала отвечают оба претендента, затем свидетели могут уточнить детали.</Instruction>
    <section className="question-card"><span><MessageCircleQuestion /></span><div><small>ВАШ ЛИЧНЫЙ ВОПРОС</small><h2>{state.self.interrogationPrompt}</h2><p>Не показывайте формулировку. Задайте вопрос своими словами и запомните первый ответ.</p></div></section>
    {state.self.archetype === "erased" && <EchoTrail echoes={state.self.echoes} />}
    <section className="secret-mission"><Sparkles /><div><small>ТАЙНАЯ ЗАДАЧА</small><strong>{state.self.secretTask}</strong></div></section>
    <section className="panel compact-panel"><div className="section-head"><div><small>СПОРНАЯ ЛИЧНОСТЬ</small><h2>{state.room.case.targetTitle}</h2></div><ScanFace /></div><div className="claimant-pair">{state.claimants.map((candidate) => <div key={candidate.id}><Avatar name={candidate.name} avatar={candidate.avatar} /><span><strong>{candidate.name}</strong><small>утверждает: «Это я»</small></span></div>)}</div></section>
    <HostBar state={state} label="Открыть улику из архива" action="advance" act={act} />
  </>;
}

function Evidence({ state, act }: { state: State; act: (action: string) => Promise<void> }) {
  return <>
    <Instruction tone="gold" icon={<FileCheck2 />} title="Сравните улику с первыми ответами">Не позволяйте претендентам переписать историю. Вспомните, что каждый сказал до открытия архива.</Instruction>
    <section className="evidence-card"><div className="evidence-stamp"><Fingerprint /></div><small>УЛИКА ПОДТВЕРЖДЕНА · ДЕЛО № {state.room.case.number}</small><h2>{state.room.case.evidenceTitle}</h2><p>{state.room.case.evidenceText}</p><div className="evidence-question"><Search /><strong>{state.room.case.evidencePrompt}</strong></div></section>
    {state.self.archetype === "erased" && <EchoTrail echoes={state.self.echoes} />}
    <section className="micro-rule"><Files /><p><strong>Последний круг:</strong> каждый претендент получает 30 секунд, чтобы объяснить улику. После этого свидетели больше не задают вопросов.</p></section>
    <HostBar state={state} label="Перейти к тайному голосованию" action="advance" act={act} />
  </>;
}

function Vote({ state, act }: { state: State; act: (action: string, payload?: Record<string, unknown>) => Promise<void> }) {
  const [candidateId, setCandidateId] = useState<string | null>(state.self.voteTargetId);
  const [identityGuess, setIdentityGuess] = useState<string | null>(state.self.identityGuess);
  const erased = state.self.archetype === "erased";

  useEffect(() => {
    setCandidateId(state.self.voteTargetId);
    setIdentityGuess(state.self.identityGuess);
  }, [state.self.voteTargetId, state.self.identityGuess]);

  const submit = () => {
    if (!candidateId) return;
    void act("vote", { targetId: candidateId, identityGuess: erased ? identityGuess : undefined });
  };

  return <>
    <Instruction tone="pink" icon={<VoteIcon />} title="Кому принадлежит эта жизнь?">Голос тайный. Выберите того, чья первая версия лучше совпала с уликой и показаниями свидетелей.</Instruction>
    <section className="panel vote-panel"><div className="section-head"><div><small>ВЫБЕРИТЕ ОРИГИНАЛ</small><h2>{state.room.case.targetTitle}</h2></div>{state.self.hasVoted && <span><Check />Голос принят</span>}</div><div className="candidate-grid">{state.claimants.map((candidate) => {
      const own = candidate.id === state.self.id;
      return <button type="button" key={candidate.id} className={candidateId === candidate.id ? "selected" : ""} onClick={() => { setCandidateId(candidate.id); haptic(); }}><Avatar name={candidate.name} avatar={candidate.avatar} size="large" /><strong>{candidate.name}</strong><small>{own ? "Это вы. Можно выбрать себя" : "Считаете настоящим"}</small>{candidateId === candidate.id && <i><Check /></i>}</button>;
    })}</div></section>
    {erased && <section className="identity-choice"><div className="section-head"><div><small>ВОССТАНОВИТЕ СЕБЯ</small><h2>Кем были вы?</h2></div><UserRoundSearch /></div><p>Сопоставьте три эха с вариантами. Нужного человека может не быть среди тех, кто назвал своё имя.</p><div className="identity-options">{state.identityOptions.map((identity) => <button type="button" key={identity} className={identityGuess === identity ? "selected" : ""} onClick={() => { setIdentityGuess(identity); haptic(); }}><span>{identity}</span>{identityGuess === identity && <Check />}</button>)}</div></section>}
    <Button className="primary-button submit-vote" disabled={!candidateId || (erased && !identityGuess)} onClick={submit}>{state.self.hasVoted ? "Изменить выбор" : "Подтвердить выбор"}<VoteIcon /></Button>
    <HostBar state={state} label={`Раскрыть личности · ${state.progress.completed}/${state.progress.required}`} action="advance" disabled={state.progress.completed < state.progress.required} act={act} />
  </>;
}

function Finished({ state, act }: { state: State; act: (action: string) => Promise<void> }) {
  const result = state.result;
  if (!result) return null;
  const outcome = result.outcome === "original"
    ? { eyebrow: "АРХИВ ПОДТВЕРДИЛ ВЫБОР", title: "Оригинал найден", text: "Комната распознала настоящую память раньше, чем двойник успел её присвоить.", tone: "truth" }
    : result.outcome === "duplicate"
      ? { eyebrow: "ПОДМЕНА ЗАВЕРШЕНА", title: "Двойник победил", text: "Чужая версия прозвучала убедительнее настоящей жизни. Архив записал нового владельца.", tone: "double" }
      : { eyebrow: "ДВЕ ОДИНАКОВЫЕ ВЕРСИИ", title: "Архив раскололся", text: "Голоса разделились поровну. Ни одна личность не получила окончательного подтверждения.", tone: "tie" };
  const erasedPlayer = result.erased ? state.players.find((player) => player.id === result.erased?.playerId) : null;

  return <>
    <section className={`result-hero result-${outcome.tone}`}><div><Fingerprint /></div><small>{outcome.eyebrow}</small><h1>{outcome.title}</h1><p>{outcome.text}</p></section>
    <section className="panel"><div className="section-head"><div><small>ДВА ПРЕТЕНДЕНТА</small><h2>Кем они были</h2></div><ScanFace /></div><div className="reveal-pair">{state.claimants.map((candidate) => {
      const original = candidate.id === result.originalId;
      return <div className={original ? "original" : "duplicate"} key={candidate.id}><Avatar name={candidate.name} avatar={candidate.avatar} size="large" /><small>{original ? "ОРИГИНАЛ" : "ДВОЙНИК"}</small><strong>{candidate.name}</strong><p>{result.voteCounts[candidate.id] ?? 0} голосов</p></div>;
    })}</div></section>
    {result.erased && <section className={`erased-result ${result.erased.correct ? "correct" : "wrong"}`}><UserRoundSearch /><div><small>{erasedPlayer?.name || "ИГРОК БЕЗ ЛИЧНОСТИ"}</small><h2>{result.erased.correct ? "Собрал себя по кусочкам" : "Поверил не тем воспоминаниям"}</h2><p>Настоящая личность: <strong>{result.erased.hiddenIdentity}</strong></p><span>Выбор игрока: {result.erased.guess || "не сделан"}</span></div></section>}
    <section className="personal-result"><span>{result.personal.score}</span><div><small>ВАШ РЕЗУЛЬТАТ</small><h2>{result.personal.title}</h2><p>{result.personal.text}</p></div></section>
    <section className="panel"><div className="section-head"><div><small>ВСЕ ДОСЬЕ ОТКРЫТЫ</small><h2>Участники дела</h2></div></div><PlayerList players={state.players} identities /></section>
    <HostBar state={state} label="Открыть новое дело" action="restart" act={act} />
  </>;
}

function Room({ session, state, refresh, sound, setSound, audio, leave }: { session: Session; state: State; refresh: () => Promise<void>; sound: boolean; setSound: (value: boolean) => void; audio: ReturnType<typeof useAudio>; leave: () => void }) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const reset = () => scrollAppTop();
    reset();
    requestAnimationFrame(reset);
  }, [state.room.phase]);

  const act = async (action: string, payload: Record<string, unknown> = {}) => {
    try {
      setBusy(true);
      await audio.cue(action === "vote" ? "tap" : action === "advance" ? "phase" : action === "acknowledge" ? "paper" : "reveal").catch(() => undefined);
      haptic(action === "advance" ? "heavy" : "medium");
      await post({ action, ...session, ...payload });
      if (action === "start") trackEvent("doubles_start", { gameId: "doubles" });
      await refresh();
    } catch (error) {
      haptic("heavy");
      toast.error(error instanceof Error ? error.message : "Действие не выполнено");
    } finally {
      setBusy(false);
    }
  };

  let content: ReactNode;
  if (state.room.phase === "lobby") content = <Lobby state={state} act={act} />;
  else if (state.room.phase === "reveal") content = <Reveal state={state} act={act} cue={audio.cue} />;
  else if (state.room.phase === "testimony") content = <Testimony state={state} act={act} />;
  else if (state.room.phase === "interrogation") content = <Interrogation state={state} act={act} />;
  else if (state.room.phase === "evidence") content = <Evidence state={state} act={act} />;
  else if (state.room.phase === "vote") content = <Vote state={state} act={act} />;
  else content = <Finished state={state} act={act} />;

  return <main className={`room room-${state.room.phase}`} aria-busy={busy}><div className="room-art" aria-hidden="true" /><div className="room-glow" aria-hidden="true" /><div className="room-inner"><RoomHeader state={state} sound={sound} setSound={setSound} leave={leave} /><div className="game-content">{content}</div></div>{busy && <div className="screen-lock"><i /></div>}</main>;
}

export function GameClient() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [ready, setReady] = useState(false);
  const [initialCode, setInitialCode] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(false);
  const [sound, setSound] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const audio = useAudio(sound);
  const previousPhase = useRef<Phase | null>(null);
  const finishedTracked = useRef(false);
  const toggleSound = (value: boolean) => {
    setSound(value);
    if (value) void audio.cue("phase", true);
  };

  useEffect(() => {
    pushToast = (message) => {
      setToastMessage(message);
      window.setTimeout(() => setToastMessage((current) => current === message ? null : current), 2800);
    };
    return () => { pushToast = () => undefined; };
  }, []);

  useEffect(() => {
    const root = document.querySelector(".doubles");
    if (!root || !sound) return;
    const start = () => { void audio.unlock(); };
    root.addEventListener("pointerdown", start);
    return () => root.removeEventListener("pointerdown", start);
  }, [sound, audio]);

  useEffect(() => {
    window.Telegram?.WebApp?.ready?.();
    window.Telegram?.WebApp?.expand?.();
    window.Telegram?.WebApp?.setHeaderColor?.("#080b1b");
    const fromLink = (searchParams.get("room") ?? "").replace(/\D/g, "").slice(0, 6);
    const last = localStorage.getItem("gnh_doubles_last") ?? "";
    const code = fromLink || "";
    setInitialCode(code || last);
    if (code) setSession(readSession(code));
    setReady(true);
  }, [searchParams]);

  const refresh = useCallback(async () => {
    if (!session) return;
    const query = new URLSearchParams({ code: session.code, token: session.token });
    if (session.hostToken) query.set("hostToken", session.hostToken);
    const response = await fetch(`${API}?${query}`, { cache: "no-store", headers: initDataHeader() });
    const result = await response.json() as State & { error?: string };
    if (!response.ok) throw new Error(result.error || "Связь с комнатой потеряна");
    setState(result);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    void refresh().catch((error) => toast.error(error instanceof Error ? error.message : "Комната недоступна")).finally(() => setLoading(false));
    const interval = window.setInterval(() => void refresh().catch(() => undefined), 1600);
    return () => clearInterval(interval);
  }, [session, refresh]);

  useEffect(() => {
    if (!state || previousPhase.current === state.room.phase) return;
    if (previousPhase.current) {
      void audio.cue(state.room.phase === "finished" ? "success" : state.room.phase === "reveal" ? "reveal" : "phase").catch(() => undefined);
      haptic(state.room.phase === "finished" ? "heavy" : "medium");
    }
    if (state.room.phase === "finished" && !finishedTracked.current) {
      finishedTracked.current = true;
      trackEvent("doubles_finish", { gameId: "doubles", outcome: state.result?.outcome });
    }
    if (state.room.phase !== "finished") finishedTracked.current = false;
    previousPhase.current = state.room.phase;
    scrollAppTop();
  }, [state, audio.cue]);

  const leave = () => {
    setSearchParams({});
    setSession(null);
    setState(null);
    setInitialCode("");
    previousPhase.current = null;
  };

  let content: ReactNode;
  if (!ready) content = <div className="boot"><i /></div>;
  else if (!session) content = <Landing initialCode={initialCode} sound={sound} setSound={toggleSound} onJoin={setSession} unlock={audio.unlock} />;
  else if (loading && !state) content = <div className="boot"><i /><p>Ищем ваше досье…</p></div>;
  else if (!state) content = <div className="boot"><Fingerprint /><p>Архив не отвечает</p><Button onClick={() => void refresh()}>Попробовать снова</Button><Button onClick={leave}>Выйти</Button></div>;
  else content = <Room session={session} state={state} refresh={refresh} sound={sound} setSound={toggleSound} audio={audio} leave={leave} />;

  return <>{content}{toastMessage && <div className="dv-toast" role="status">{toastMessage}</div>}</>;
}
