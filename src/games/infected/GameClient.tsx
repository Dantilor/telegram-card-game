import { useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Activity, Biohazard, Check, ChevronRight, Clock3, Copy, Crown, EyeOff,
  FlaskConical, HeartPulse, HelpCircle, Loader2, LockKeyhole, LogIn, LogOut, X,
  Microscope, Plus, Radio, RefreshCw, RotateCcw, ScanLine, Shield,
  ShieldCheck, Smartphone, Snowflake, TriangleAlert, UserRoundX, Users,
  Volume2, VolumeX, Wifi, Wrench, Zap,
} from "lucide-react";
import { useBack } from "../../hooks/useBack";
import { usePremium } from "../../contexts/PremiumContext";
import HomeButton from "../../components/HomeButton";
import BackButton from "../../components/BackButton";
import PremiumOverlay from "../../components/PremiumOverlay";
import { getApiBaseUrl } from "../../api/client";
import { trackEvent } from "../../lib/analytics";
import { getInitData } from "../../lib/telegram";

const API = `${getApiBaseUrl()}/api/games/infected`;
function initHeaders(): Record<string, string> {
  const initData = getInitData();
  return initData ? { "x-telegram-init-data": initData } : {};
}
let pushToast: (message: string) => void = () => undefined;
const toast = { error: (m: string) => pushToast(m), success: (m: string) => pushToast(m), info: (m: string) => pushToast(m) };
function Button({ className = "", children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={className} {...props}>{children}</button>;
}
function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={className} {...props} />;
}
function Progress({ value, className = "" }: { value: number; className?: string }) {
  return <div data-slot="progress" className={className}><span data-slot="progress-indicator" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}
function Picker({ value, onChange, placeholder, options }: { value: string; onChange: (value: string) => void; placeholder: string; options: Array<{ value: string; label: string }> }) {
  return <select className="game-select" value={value} onChange={(event) => onChange(event.target.value)}><option value="">{placeholder}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
}

type Phase = "lobby" | "briefing" | "operations" | "council" | "result" | "ended";
type Systems = { power: number; lab: number; comms: number; life: number };
type Player = { id: string; name: string; isHost: boolean; quarantined: boolean; ready: boolean; taskDone: boolean; voted: boolean; finalRole?: "crew" | "infected" };
type Game = {
  room: { code: string; phase: Phase; round: number; maxRounds: number; tasksDone: number; taskTarget: number; crewScore: number; infectionLevel: number; systems: Systems; event: { kind?: string; title?: string; text?: string; quarantinedId?: string | null }; winner: "crew" | "infected" | null; version: number };
  me: { id: string; name: string; isHost: boolean; job: string; infectionStatus: "healthy" | "active"; awakenedThisRound: boolean; quarantined: boolean; ready: boolean; taskDone: boolean; voteSubmitted: boolean; darkActionUsed: boolean; conversionUsed: boolean; specialActionUsed: boolean; protected: boolean; ability: "analyze" | "repair" | "protect" | "stabilize"; analysisText: string; privateNotice: string; teammates: Array<{ id: string; name: string }> };
  players: Player[];
};
type Session = { playerId: string; token: string; code: string };
type Props = { game: Game; busy: boolean; act: (name: string, payload?: Record<string, unknown>) => Promise<void> };

const SESSION = "gnh_infected_session";
const LAST_SESSION = "gnh_infected_last_session";
const SOUND = "gnh_infected_sound";
const jobs: Record<string, { title: string; dept: string; bio: string; access: string }> = {
  medic: { title: "Полевой медик", dept: "Медблок", bio: "Ищите биологические отклонения и следите за экипажем.", access: "Закрытый анализ одного игрока" },
  engineer: { title: "Главный инженер", dept: "Энергоконтур", bio: "Станция держится на ваших аварийных ремонтах.", access: "Восстановить систему на 20%" },
  security: { title: "Офицер безопасности", dept: "Периметр", bio: "Не дайте организму выбрать лёгкую цель.", access: "Тайно защитить игрока от обращения" },
  biologist: { title: "Ксенобиолог", dept: "Лаборатория", bio: "Вы знаете, как выглядит нормальная клетка. Пока ещё знаете.", access: "Закрытый анализ одного игрока" },
  analyst: { title: "Системный аналитик", dept: "Диагностика", bio: "Сопоставляйте факты — результаты можно подделать.", access: "Закрытый анализ одного игрока" },
  technician: { title: "Техник шлюзов", dept: "Карантин", bio: "Чините то, что кто-то намеренно ломает.", access: "Восстановить систему на 20%" },
  commander: { title: "Начальник смены", dept: "Командный модуль", bio: "Сохраняйте порядок, даже если доверять уже некому.", access: "Тайно защитить игрока от обращения" },
  operator: { title: "Оператор связи", dept: "Узел связи", bio: "Сверяйте сигналы и замечайте ложь в докладах.", access: "Стабилизировать слабую систему" },
  navigator: { title: "Навигатор", dept: "Центр управления", bio: "Держите маршрут эвакуации открытым.", access: "Стабилизировать слабую систему" },
  psychologist: { title: "Психолог экспедиции", dept: "Наблюдение", bio: "Слушайте не слова, а паузы между ними.", access: "Стабилизировать слабую систему" },
  geologist: { title: "Геолог", dept: "Внешний сектор", bio: "Вы первым увидели образец. Возможно, это важно.", access: "Стабилизировать слабую систему" },
  quartermaster: { title: "Квартирмейстер", dept: "Склад K-4", bio: "Контролируйте любые необъяснимые перемещения.", access: "Стабилизировать слабую систему" },
  crew: { title: "Член экипажа", dept: "Станция K-17", bio: "Личность ещё не назначена.", access: "Ожидание" },
};
const tasks: Record<string, Array<[string, string]>> = {
  medic: [["Сверить криокапсулы", "Проверьте температуру медицинских ячеек."], ["Обновить сыворотку", "Подтвердите хранение образцов."]],
  engineer: [["Синхронизировать генераторы", "Выровняйте нагрузку энергоконтура."], ["Перезапустить насосы", "Подтвердите давление аварийной линии."]],
  security: [["Проверить шлюзы", "Сверьте замки с журналом перемещений."], ["Калибровать камеры", "Верните обзор в слепой сектор."]],
  biologist: [["Изолировать культуру", "Закройте контейнер с неизвестным образцом."], ["Очистить секвенатор", "Удалите биологический шум."]],
  analyst: [["Сверить телеметрию", "Найдите расхождение в отчёте."], ["Проверить журнал", "Подтвердите целостность записей."]],
  technician: [["Герметизировать сектор", "Закройте сервисный канал у карантина."], ["Заменить предохранитель", "Верните питание шлюзу."]],
  default: [["Подтвердить протокол", "Сверьте показания рабочей станции."], ["Проверить сектор", "Завершите обход и передайте отчёт."]],
};
const systemMeta: Record<keyof Systems, { title: string; icon: typeof Zap }> = {
  power: { title: "Энергия", icon: Zap }, lab: { title: "Лаборатория", icon: FlaskConical },
  comms: { title: "Связь", icon: Radio }, life: { title: "Жизнеобеспечение", icon: HeartPulse },
};

// Panels use backdrop-filter, which traps position: fixed; dialogs must render outside them.
function Overlay({ children }: { children: ReactNode }) {
  const host = typeof document !== "undefined" ? document.querySelector(".app") ?? document.body : null;
  return host ? createPortal(<div className="infected-game inf-portal">{children}</div>, host) : null;
}
function Rules({ text = false }: { text?: boolean }) {
  const [open, setOpen] = useState(false);
  return <>
    <Button className={text ? "rules-button" : "icon-button"} aria-label="Правила" onClick={() => setOpen(true)}><HelpCircle />{text && "Как играть"}</Button>
    {open && <Overlay><div className="inf-dialog" role="dialog" aria-modal="true" onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><div className="rules-dialog"><button type="button" className="icon-button inf-dialog-close" aria-label="Закрыть" onClick={() => setOpen(false)}><X /></button><p className="eyebrow">ПРОТОКОЛ K-17</p><h2>Как выжить на станции</h2><p>У каждого свой телефон и только один экран — свой.</p>
      <div className="rules-list">
        <Rule n="01" title="Получите личность">Экипаж видит профессию и спецдоступ. Заражённые получают маскировку и тёмный канал.</Rule>
        <Rule n="02" title="Каждый выполняет протокол">В каждом цикле все на станции нажимают свой протокол. Совет откроется только после всех. Спецдоступ и тёмный канал — по желанию.</Rule>
        <Rule n="03" title="Организм может сорвать протокол">Заражённый тайно срывает свой протокол — для всех он выглядит выполненным. На совете станция покажет число сбоев, но не имена.</Rule>
        <Rule n="04" title="Не верьте приборам вслепую">Обращённый сначала считает себя здоровым. Лабораторные результаты могут оказаться ложными.</Rule>
        <Rule n="05" title="Совет и карантин">Все на станции голосуют. Первый совет только называет подозреваемого, карантин — со второго цикла. Игрок в карантине молча наблюдает. Если это начальник, он продолжает переключать этапы.</Rule>
      </div>
      <div className="win-grid"><div><ShieldCheck /><strong>Экипаж</strong><span>3 чистых цикла, все заражённые в карантине со 2-го цикла, или 2 чистых цикла и перевес к концу 4-го</span></div><div><Biohazard /><strong>Организм</strong><span>заражённых не меньше, чем здоровых, система на нуле, заражение 100% или конец 4-го цикла без перевеса экипажа</span></div></div>
    </div></div></Overlay>}
  </>;
}
function Rule({ n, title, children }: { n: string; title: string; children: string }) { return <div className="rule-row"><span>{n}</span><div><strong>{title}</strong><p>{children}</p></div></div>; }
function Loader() { return <div className="loading-screen"><div className="bio-loader"><Biohazard /></div><p className="eyebrow">УСТАНАВЛИВАЕМ ЗАЩИЩЁННЫЙ КАНАЛ</p></div>; }

function Header({ game, sound, setSound, exit }: { game: Game; sound: boolean; setSound: () => void; exit: () => void }) {
  const handleBack = useBack("/games");
  const [confirm, setConfirm] = useState(false);
  return <header className="room-header">
    <div className="game-page inf-nav"><div className="game-page__top"><HomeButton className="game-page__nav-btn" /><BackButton className="game-page__nav-btn" onClick={handleBack} /></div></div>
    <div className="room-header-row">
      <button className="mini-brand" onClick={() => setConfirm(true)} aria-label="Выйти со станции"><LogOut /><span>Выйти</span></button>
      <div className="room-header-center"><span>СТАНЦИЯ</span><strong>{game.room.code}</strong></div>
      <div className="header-actions"><button className="header-icon" onClick={setSound} aria-label="Звук">{sound ? <Volume2 /> : <VolumeX />}</button><Rules /></div>
    </div>
    {confirm && <Overlay><div className="inf-dialog" role="dialog" aria-modal="true"><div className="rules-dialog exit-dialog"><p className="eyebrow">ВЫХОД СО СТАНЦИИ</p><h2>Точно выйти?</h2><p>Партия продолжится без вас{game.me.isHost ? ", а вести этапы может только начальник — остальные будут ждать" : ""}. Вернуться можно с этого телефона: на экране входа появится кнопка «Вернуться на станцию {game.room.code}».</p><div className="exit-actions"><Button className="secondary-action" onClick={() => setConfirm(false)}>Остаться</Button><Button className="danger-action" onClick={() => { setConfirm(false); exit(); }}>Выйти</Button></div></div></div></Overlay>}
  </header>;
}
function waitingNames(players: Player[], done: (player: Player) => boolean) {
  const names = players.filter(p => !p.quarantined && !done(p)).map(p => p.name);
  return names.length > 4 ? `${names.slice(0, 4).join(", ")} и ещё ${names.length - 4}` : names.join(", ");
}
function Step({ title, children }: { title: string; children: string }) {
  return <section className="step-card panel"><p className="eyebrow">ЧТО ДЕЛАТЬ СЕЙЧАС</p><h2>{title}</h2><p>{children}</p></section>;
}
function PhaseBar({ game }: { game: Game }) {
  const names: Record<Phase, string> = { lobby: "Сбор экипажа", briefing: "Личный допуск", operations: "Рабочий цикл", council: "Общий совет", result: game.room.round < 2 && !game.room.event.quarantinedId ? "Первый совет" : "Карантин", ended: "Протокол завершён" };
  return <div className="phase-strip"><div><span className="live-dot" />{names[game.room.phase]}</div>{game.room.round > 0 && <span>ЦИКЛ {game.room.round}/{game.room.maxRounds}</span>}</div>;
}
function Event({ game }: { game: Game }) { const e = game.room.event; return <section className={`event-card ${e.kind ?? ""}`}><div className="event-icon">{e.kind === "failure" || e.kind === "ended" ? <TriangleAlert /> : <ScanLine />}</div><div><p className="eyebrow">СИСТЕМНОЕ СООБЩЕНИЕ</p><h2>{e.title ?? "Станция K-17"}</h2><p>{e.text ?? "Ожидание протокола."}</p></div></section>; }
function SystemsPanel({ game }: { game: Game }) {
  return <section className="systems-panel panel"><div className="section-heading"><div><span>СОСТОЯНИЕ СТАНЦИИ</span><h2>Контур K-17</h2></div><Activity /></div>
    <div className="systems-grid">{(Object.keys(game.room.systems) as Array<keyof Systems>).map(key => { const Icon = systemMeta[key].icon, value = game.room.systems[key]; return <div className="system-row" key={key}><div className="system-label"><span><Icon />{systemMeta[key].title}</span><strong className={value < 40 ? "danger-text" : ""}>{value}%</strong></div><Progress value={value} className={`system-progress ${value < 40 ? "critical" : ""}`} /></div>; })}</div>
    <div className="infection-meter"><div><Biohazard /><span>УРОВЕНЬ ЗАРАЖЕНИЯ</span><strong>{game.room.infectionLevel}%</strong></div><Progress value={game.room.infectionLevel} className="infection-progress" /></div>
  </section>;
}
function PlayerSelect({ game, value, change, self = false }: { game: Game; value: string; change: (v: string) => void; self?: boolean }) {
  return <Picker value={value} onChange={change} placeholder="Выберите игрока" options={game.players.filter(p => !p.quarantined && (self || p.id !== game.me.id)).map(p => ({ value: p.id, label: `${p.name}${p.id === game.me.id ? " (вы)" : ""}` }))} />;
}
function SystemSelect({ value, change }: { value: string; change: (v: string) => void }) {
  return <Picker value={value} onChange={change} placeholder="Выберите систему" options={(Object.keys(systemMeta) as Array<keyof Systems>).map(key => ({ value: key, label: systemMeta[key].title }))} />;
}

function Lobby({ game, busy, act, share }: Props & { share: () => void }) {
  return <div className="screen-stack"><PhaseBar game={game} /><Step title={game.me.isHost ? "Соберите экипаж" : "Ждите старта"}>{game.me.isHost ? "Отправьте код друзьям. Когда подключатся 4–12 человек, начните смену." : "Вы на станции. Начальник запустит смену, когда все подключатся."}</Step>
    <section className="lobby-code panel"><p className="eyebrow">КОД ДОСТУПА</p><button className="code-display" onClick={share}>{game.room.code}<Copy /></button><p>Откройте игру на остальных телефонах и введите этот код.</p></section>
    <section className="panel roster-panel"><div className="section-heading"><div><span>ЭКИПАЖ</span><h2>{game.players.length} из 12 подключены</h2></div><Users /></div><div className="roster-list">{game.players.map((p, i) => <div className="roster-row" key={p.id}><span className="avatar-code">{String(i + 1).padStart(2, "0")}</span><strong>{p.name}</strong>{p.isHost ? <span className="host-badge"><Crown /> начальник</span> : <span className="connected-badge"><Wifi /> в сети</span>}</div>)}</div></section>
    {game.me.isHost ? <div className="host-launch"><Button className="primary-action" disabled={busy || game.players.length < 4} onClick={() => act("start")}>{busy ? <Loader2 className="animate-spin" /> : <LockKeyhole />}Запечатать станцию и начать</Button><p>Нужно от 4 до 12 игроков. Партия идёт около 25–40 минут.</p></div> : <Wait title="Ожидаем начальника смены" text="Роль появится автоматически." />}
  </div>;
}
function Wait({ title, text }: { title: string; text: string }) { return <div className="waiting-card"><span className="pulse-ring"><Radio /></span><div><strong>{title}</strong><p>{text}</p></div></div>; }

function Briefing({ game, busy, act }: Props) {
  const bad = game.me.infectionStatus === "active", job = jobs[game.me.job] ?? jobs.crew, left = game.players.filter(p => !p.ready).length;
  return <div className="screen-stack"><PhaseBar game={game} /><Step title="Прочитайте карточку тайно">Запомните роль и нажмите «Готов». Смена начнётся сама, когда подтвердят все.</Step><div className="privacy-warning"><EyeOff />Не показывайте этот экран другим</div>
    <section className={`identity-card ${bad ? "infected" : "crew"}`}><div className="identity-orbit">{bad ? <Biohazard /> : <Shield />}</div><p className="eyebrow">ВАШ СТАТУС</p><h1>{bad ? "ЗАРАЖЁННЫЙ" : job.title}</h1><p className="identity-department">{bad ? `Прикрытие: ${job.title}` : job.dept}</p><div className="identity-copy">{bad ? <><p>Организм уже контролирует вас. Ведите себя как обычный член экипажа, выполняйте задания для маскировки и используйте тёмный канал.</p><div className="secret-objective"><Biohazard /><span><strong>Цель:</strong> заразить половину станции или разрушить системы.</span></div>{game.me.teammates.length > 0 && <p className="teammates">Другие заражённые: {game.me.teammates.map(p => p.name).join(", ")}</p>}</> : <><p>{job.bio}</p><div className="secret-objective crew-objective"><ShieldCheck /><span><strong>Спецдоступ:</strong> {job.access}.</span></div><p className="uncertainty-note">Прибор считает вас здоровым. Но ранняя стадия заражения не определяется.</p></>}</div></section>
    {!game.me.ready ? <Button className="primary-action" disabled={busy} onClick={() => act("ready")}>{busy ? <Loader2 className="animate-spin" /> : <Check />}Я всё понял — готов</Button> : <Wait title="Ваш допуск подтверждён" text={`Осталось подтвердить: ${left}`} />}
  </div>;
}

function Task({ game, busy, act }: Props) {
  const pool = tasks[game.me.job] ?? tasks.default, item = pool[(game.room.round - 1) % pool.length];
  const organism = game.me.infectionStatus === "active";
  return <section className={`task-card panel ${game.me.taskDone ? "complete" : ""}`}><div className="task-topline"><span><ScanLine />ОБЯЗАТЕЛЬНЫЙ ПРОТОКОЛ</span><strong>{game.me.taskDone ? "ОТПРАВЛЕНО" : `K17-${game.room.round}${game.me.id.slice(0, 2).toUpperCase()}`}</strong></div><h2>{item[0]}</h2><p>{item[1]}</p>
    {game.me.taskDone ? <Button className="task-action" disabled><Check />Протокол отправлен</Button> : organism ? <><p className="private-notice">Вы организм. Выполните честно, чтобы не выдать себя, или тайно сорвите — для всех кнопка выглядит одинаково.</p><div className="task-choice"><Button className="task-action" disabled={busy} onClick={() => act("task")}>{busy ? <Loader2 className="animate-spin" /> : <ScanLine />}Выполнить</Button><Button className="dark-action" disabled={busy} onClick={() => act("task", { sabotage: true })}><Biohazard />Тайно сорвать</Button></div></> : <Button className="task-action" disabled={busy} onClick={() => act("task")}>{busy ? <Loader2 className="animate-spin" /> : <ScanLine />}Выполнить проверку</Button>}
  </section>;
}
function Dark({ game, busy, act }: Props) {
  const [mode, setMode] = useState("infect"), [target, setTarget] = useState(""), [system, setSystem] = useState("");
  const submit = () => mode === "infect" ? act("dark", { mode, targetId: target }) : mode === "sabotage" ? act("dark", { mode, system }) : act("dark", { mode });
  return <section className="dark-panel panel"><div className="dark-heading"><div className="dark-symbol"><Biohazard /></div><div><span>ЗАШИФРОВАНО</span><h2>Тёмный канал</h2></div><LockKeyhole /></div>
    {game.me.awakenedThisRound && <div className="awakening-alert"><Biohazard /><span><strong>Организм проснулся.</strong> До этого цикла вы действительно не знали, что заражены.</span></div>}
    {game.me.teammates.length > 0 && <p className="channel-team">В контакте: {game.me.teammates.map(p => p.name).join(", ")}</p>}
    <div className="dark-tabs"><button className={mode === "infect" ? "active" : ""} onClick={() => setMode("infect")}>Обратить</button><button className={mode === "sabotage" ? "active" : ""} onClick={() => setMode("sabotage")}>Саботаж</button><button className={mode === "forge" ? "active" : ""} onClick={() => setMode("forge")}>Подмена</button></div>
    <div className="dark-body">{mode === "infect" ? <><p>Цель ничего не узнает до следующего цикла.</p><PlayerSelect game={game} value={target} change={setTarget} />{game.me.conversionUsed && <span className="used-note">Обращение уже использовано в этой партии.</span>}</> : mode === "sabotage" ? <><p>Повредите систему. Авария будет выглядеть случайной.</p><SystemSelect value={system} change={setSystem} /></> : <p>Медицинские анализы этого цикла могут показать ложный результат.</p>}</div>
    <Button className="dark-action" disabled={busy || game.me.darkActionUsed || game.me.quarantined || (mode === "infect" && (!target || game.me.conversionUsed)) || (mode === "sabotage" && !system)} onClick={submit}>{busy ? <Loader2 className="animate-spin" /> : <Biohazard />}{game.me.darkActionUsed ? "Действие использовано" : "Активировать незаметно"}</Button>
    {game.me.privateNotice && <p className="private-notice">{game.me.privateNotice}</p>}
  </section>;
}
function Special({ game, busy, act }: Props) {
  const [target, setTarget] = useState(""), [system, setSystem] = useState(""), job = jobs[game.me.job] ?? jobs.crew, kind = game.me.ability;
  const submit = () => kind === "analyze" || kind === "protect" ? act("special", { targetId: target }) : kind === "repair" ? act("special", { system }) : act("special");
  return <section className="special-panel panel"><div className="special-heading"><div className="special-icon">{kind === "analyze" ? <Microscope /> : kind === "repair" ? <Wrench /> : <ShieldCheck />}</div><div><span>СПЕЦДОСТУП // {job.dept}</span><h2>{job.access}</h2></div></div>
    {kind === "analyze" && <PlayerSelect game={game} value={target} change={setTarget} />}{kind === "protect" && <PlayerSelect game={game} value={target} change={setTarget} self />}{kind === "repair" && <SystemSelect value={system} change={setSystem} />}{kind === "stabilize" && <p className="ability-copy">Система найдёт самый слабый контур и восстановит 10%.</p>}
    <Button className="secondary-action" disabled={busy || game.me.specialActionUsed || game.me.quarantined || ((kind === "analyze" || kind === "protect") && !target) || (kind === "repair" && !system)} onClick={submit}>{busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />}{game.me.specialActionUsed ? "Доступ использован" : "Использовать доступ"}</Button>
    {game.me.analysisText && <div className="analysis-result"><span><FlaskConical />ЗАКРЫТЫЙ РЕЗУЛЬТАТ</span><p>{game.me.analysisText}</p><small>Вы сами решаете, что сказать остальным.</small></div>}{game.me.privateNotice && !game.me.analysisText && <p className="private-notice crew-notice">{game.me.privateNotice}</p>}
  </section>;
}
function Operations({ game, busy, act }: Props) {
  const progress = game.room.taskTarget ? Math.min(100, game.room.tasksDone / game.room.taskTarget * 100) : 0;
  const allDone = game.room.taskTarget > 0 && game.room.tasksDone >= game.room.taskTarget;
  const waiting = waitingNames(game.players, p => p.taskDone);
  const step = game.me.quarantined
    ? (game.me.isHost ? "Вы в карантине, но продолжаете вести смену. Дождитесь протоколов остальных и откройте совет." : "Вы в карантине. Наблюдайте молча — действовать и голосовать нельзя.")
    : game.me.taskDone
      ? (allDone ? (game.me.isHost ? "Все протоколы отправлены. Откройте общий совет." : "Все протоколы отправлены. Ждём, когда начальник откроет совет.") : `Ваш протокол отправлен. Ждём: ${waiting}.`)
      : "Нажмите свой обязательный протокол ниже. Спецдоступ — по желанию. Совет откроется, когда протокол отправят все.";
  return <div className="screen-stack"><PhaseBar game={game} /><Step title={game.me.quarantined ? "Карантин" : game.me.taskDone ? "Ожидание экипажа" : "Выполните протокол"}>{step}</Step>
    {game.me.quarantined && <section className="quarantined-card"><UserRoundX /><div><p className="eyebrow">ДОСТУП ЗАБЛОКИРОВАН</p><h2>Вы в карантине</h2><p>{game.me.isHost ? "Ваша роль скрыта до финала. Кнопки начальника остаются у вас." : "Ваша роль скрыта до финала. Остальные продолжают без вас."}</p></div></section>}
    <section className="team-progress panel"><div><span>ПРОТОКОЛЫ ЦИКЛА</span><strong>{game.room.tasksDone}/{game.room.taskTarget}</strong></div><Progress value={progress} className="team-progress-bar" /><p>{allDone ? "Все на станции отправили протокол." : `Ждём: ${waiting}.`} Срыв станет известен только на совете.</p></section>
    {!game.me.quarantined && <><Task game={game} busy={busy} act={act} />{game.me.infectionStatus === "active" ? <Dark game={game} busy={busy} act={act} /> : <Special game={game} busy={busy} act={act} />}</>}
    {game.me.isHost && <section className="host-control panel"><div><Crown /><span><strong>Управление сменой</strong>{allDone ? "Все протоколы отправлены — можно открывать совет." : `Совет откроется после всех протоколов. Ждём: ${waiting}.`}</span></div><Button className="council-action" disabled={busy || !allDone} onClick={() => act("council")}>Созвать общий совет<ChevronRight /></Button></section>}
    <Event game={game} /><SystemsPanel game={game} />
    <section className="team-progress panel"><div><span>ЧИСТЫЕ ЦИКЛЫ ЭКИПАЖА</span><strong>{game.room.crewScore}/3</strong></div><p>Цикл чистый, если ни один протокол не сорван. Три чистых цикла — победа экипажа.</p></section>
  </div>;
}
function Council({ game, busy, act }: Props) {
  const [choice, setChoice] = useState(""), eligible = game.players.filter(p => !p.quarantined).length, voted = game.players.filter(p => !p.quarantined && p.voted).length, observation = game.room.round < 2;
  const allVoted = eligible > 0 && voted >= eligible, waiting = waitingNames(game.players, p => p.voted);
  return <div className="screen-stack"><PhaseBar game={game} /><Step title={game.me.quarantined ? "Наблюдайте" : game.me.voteSubmitted ? "Голос отправлен" : "Обсудите и проголосуйте"}>{game.me.quarantined ? (game.me.isHost ? "Вы в карантине и не голосуете, но подводите итог, когда проголосуют все." : "Игроки в карантине не голосуют.") : game.me.voteSubmitted ? (allVoted ? "Все проголосовали. Ждём итог от начальника." : `Ждём голоса: ${waiting}.`) : "Обсудите вслух, затем выберите игрока ниже. Итог откроется после всех голосов."}</Step><Event game={game} /><section className="discussion-timer panel"><div className="discussion-orbit"><Users /></div><div><p className="eyebrow">ЗА СТОЛОМ</p><h2>Говорите вслух. Экраны — только для голосования.</h2><p>{observation ? "Первый цикл: назовите подозреваемого. Шлюз пока не закрывается." : "Сравните рассказы, задания, аварии и анализы."}</p></div></section>
    <section className="vote-panel panel"><div className="section-heading"><div><span>{observation ? "ПОДОЗРЕНИЕ" : "КАРАНТИННОЕ ГОЛОСОВАНИЕ"}</span><h2>{observation ? "Кого подозреваете?" : "Кому вы не доверяете?"}</h2></div><span className="vote-count">{voted}/{eligible}</span></div>
      {game.me.quarantined ? <p className="muted-copy">Игроки в карантине не голосуют.</p> : game.me.voteSubmitted ? <div className="vote-locked"><LockKeyhole /><div><strong>Голос зашифрован</strong><p>Выбор нельзя изменить.</p></div></div> : <><div className="vote-options">{game.players.filter(p => !p.quarantined && p.id !== game.me.id).map(p => <button type="button" className={`vote-option ${choice === p.id ? "active" : ""}`} key={p.id} onClick={() => setChoice(p.id)}><span className="vote-avatar">{p.name[0].toUpperCase()}</span><strong>{p.name}</strong>{p.isHost && <Crown />}</button>)}</div><Button className={observation ? "secondary-action" : "danger-action"} disabled={busy || !choice} onClick={() => act("vote", { targetId: choice })}>{busy ? <Loader2 className="animate-spin" /> : observation ? <EyeOff /> : <UserRoundX />}{observation ? "Назвать подозреваемого" : "Отправить в карантин"}</Button></>}
    </section>{game.me.isHost && <section className="host-control panel"><div><Crown /><span><strong>Голосов: {voted} из {eligible}</strong>{allVoted ? "Все проголосовали — подведите итог." : `Итог откроется после всех голосов. Ждём: ${waiting}.`}</span></div><Button className="council-action" disabled={busy || !allVoted} onClick={() => act("resolve")}>Подвести итог<ChevronRight /></Button></section>}
  </div>;
}
function Result({ game, busy, act }: Props) {
  const target = game.players.find(p => p.id === game.room.event.quarantinedId);
  const observation = game.room.round < 2 && !target;
  return <div className="screen-stack"><PhaseBar game={game} /><Step title={game.me.isHost ? "Запустите следующий цикл" : "Ждём следующий цикл"}>{game.me.isHost ? "Прочитайте итог вслух и нажмите кнопку внизу. Начнётся новый цикл протоколов." : "Начальник запустит новый цикл. Экран обновится сам."}</Step><section className="result-card panel"><div className="sealed-door"><span />{observation ? <EyeOff /> : <UserRoundX />}</div><p className="eyebrow">{observation ? "ПЕРВЫЙ СОВЕТ" : "КАРАНТИННЫЙ ШЛЮЗ"}</p><h1>{target?.name ?? (observation ? "Шлюз открыт" : "Никто не изолирован")}</h1><p>{game.room.event.text}</p>{!observation && <div className="classified-line"><EyeOff />БИОСТАТУС ЗАСЕКРЕЧЕН ДО ФИНАЛА</div>}</section><SystemsPanel game={game} />{game.me.isHost ? <Button className="primary-action" disabled={busy} onClick={() => act("next")}>{busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}Запустить следующий цикл</Button> : <Wait title="Ожидаем следующий цикл" text="Экран обновится автоматически." />}</div>;
}
function End({ game, busy, act }: Props) {
  const crew = game.room.winner === "crew";
  return <div className="screen-stack end-stack"><PhaseBar game={game} /><section className={`ending-card ${crew ? "crew-win" : "infected-win"}`}><div className="ending-symbol">{crew ? <Snowflake /> : <Biohazard />}</div><p className="eyebrow">ПРОТОКОЛ ЗАВЕРШЁН</p><h1>{crew ? "ЭКИПАЖ ВЫЖИЛ" : "СТАНЦИЯ ЗАРАЖЕНА"}</h1><p>{game.room.event.text}</p><div className="score-rack"><div><strong>{game.room.crewScore}/3</strong><span>протоколы</span></div><div><strong>{game.room.infectionLevel}%</strong><span>заражение</span></div><div><strong>{game.room.round}</strong><span>циклы</span></div></div></section>
    <section className="panel reveal-panel"><div className="section-heading"><div><span>РАССЕКРЕЧЕНО</span><h2>Кем был каждый</h2></div><EyeOff /></div><div className="reveal-list">{game.players.map(p => <div key={p.id} className={`reveal-row ${p.finalRole}`}><span>{p.name[0].toUpperCase()}</span><strong>{p.name}</strong><em>{p.finalRole === "infected" ? <Biohazard /> : <ShieldCheck />}{p.finalRole === "infected" ? "заражённый" : "экипаж"}</em></div>)}</div></section>
    {game.me.isHost ? <Button className="primary-action" disabled={busy} onClick={() => act("restart")}>{busy ? <Loader2 className="animate-spin" /> : <RotateCcw />}Сыграть ещё раз</Button> : <Wait title="Начальник может запустить реванш" text="Комната и экипаж сохранятся." />}
  </div>;
}

function Home({ name, setName, code, setCode, mode, setMode, busy, enter, sound, setSound, premiumOpen, setPremiumOpen, lastSession, resume }: { name: string; setName: (v: string) => void; code: string; setCode: (v: string) => void; mode: "create" | "join"; setMode: (v: "create" | "join") => void; busy: boolean; enter: () => void; sound: boolean; setSound: () => void; premiumOpen: boolean; setPremiumOpen: (value: boolean) => void; lastSession: Session | null; resume: () => void }) {
  const handleBack = useBack("/games");
  const { isPremium } = usePremium();
  return <div className="home-layout">
    <div className="game-page inf-nav"><div className="game-page__top"><HomeButton className="game-page__nav-btn" /><BackButton className="game-page__nav-btn" onClick={handleBack} /></div></div>
    <section className="home-story"><div className="station-tag"><span />СТАНЦИЯ K-17 // СИГНАЛ ПОТЕРЯН</div><div className="hero-mark"><Biohazard /></div><p className="hero-kicker">СОЦИАЛЬНАЯ ИГРА НА НЕДОВЕРИЕ</p><h1>ЗАРАЖЁННЫЕ</h1><p className="hero-copy">Неизвестный организм уже внутри станции. Возможно — внутри тебя.</p><div className="meta-row"><span><Users />4–12 игроков</span><span><Clock3 />25–40 минут</span><span><Smartphone />каждый со своего телефона</span></div></section>
    {lastSession && <Button className="primary-action resume-action" onClick={resume}><RefreshCw />Вернуться на станцию {lastSession.code}</Button>}
    <section className="entry-panel panel"><div className="entry-topline"><div><p className="eyebrow">ПРОТОКОЛ ПОДКЛЮЧЕНИЯ</p><h2>{mode === "create" ? "Открыть новую станцию" : "Войти в смену"}</h2></div><button className="header-icon" onClick={setSound} aria-label="Звук">{sound ? <Volume2 /> : <VolumeX />}</button></div><div className="entry-tabs"><button className={mode === "create" ? "active" : ""} onClick={() => setMode("create")}><Plus />Создать</button><button className={mode === "join" ? "active" : ""} onClick={() => setMode("join")}><LogIn />Войти по коду</button></div>
      <label className="field-label" htmlFor="name">Ваше имя</label><Input id="name" className="game-input" value={name} maxLength={20} placeholder="Как к вам обращаться?" onChange={e => setName(e.target.value)} />
      {mode === "join" && <><label className="field-label" htmlFor="room-code">Код станции</label><Input id="room-code" className="game-input" value={code} maxLength={6} inputMode="numeric" autoComplete="one-time-code" placeholder="6 цифр, например 482915" onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} /></>}
      <Button className="primary-action entry-action" disabled={busy || (mode === "join" && (name.trim().length < 2 || code.length !== 6)) || (mode === "create" && isPremium && name.trim().length < 2)} onClick={() => { if (mode === "create" && !isPremium) { setPremiumOpen(true); return; } enter(); }}>{busy ? <Loader2 className="animate-spin" /> : mode === "create" ? <Plus /> : <LogIn />}{mode === "create" ? (isPremium ? "Создать станцию" : "Создать станцию · Premium") : "Подключиться"}</Button><div className="entry-footer"><Rules text /></div>
    </section>
    <PremiumOverlay isOpen={premiumOpen} onClose={() => setPremiumOpen(false)} />
  </div>;
}

export default function GameClient() {
  const [session, setSession] = useState<Session | null>(null), [game, setGame] = useState<Game | null>(null), [hydrated, setHydrated] = useState(false), [busy, setBusy] = useState(false), [offline, setOffline] = useState(false);
  const [name, setName] = useState(""), [joinCode, setJoinCode] = useState(""), [mode, setMode] = useState<"create" | "join">("create"), [sound, setSoundState] = useState(true);
  const [premiumOpen, setPremiumOpen] = useState(false), [notice, setNotice] = useState(""), [lastSession, setLastSession] = useState<Session | null>(null);
  const audio = useRef<AudioContext | null>(null), lastPhase = useRef(""), oscillators = useRef<OscillatorNode[]>([]), soundRef = useRef(sound);
  soundRef.current = sound;
  const cue = useCallback((kind: "tap" | "ok" | "alarm", force = false) => {
    if ((!soundRef.current && !force) || typeof window === "undefined") return;
    try {
      const Ctx = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = audio.current ?? new Ctx();
      audio.current = ctx;
      void ctx.resume();
      const notes = kind === "alarm" ? [92, 69] : kind === "ok" ? [392, 523] : [240];
      notes.forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + i * .11;
        oscillators.current.push(o);
        o.onended = () => { oscillators.current = oscillators.current.filter((item) => item !== o); };
        o.type = kind === "alarm" ? "sawtooth" : "sine";
        o.frequency.value = f;
        g.gain.setValueAtTime(.0001, t);
        g.gain.exponentialRampToValueAtTime(kind === "alarm" ? .16 : .12, t + .02);
        g.gain.exponentialRampToValueAtTime(.0001, t + .24);
        o.connect(g).connect(ctx.destination);
        o.start(t);
        o.stop(t + .26);
      });
    } catch { /* audio is optional */ }
  }, []);
  useEffect(() => () => {
    for (const node of oscillators.current) {
      try { node.stop(); } catch { /* already stopped */ }
    }
    oscillators.current = [];
    const current = audio.current;
    audio.current = null;
    if (current && current.state !== "closed") void current.close();
  }, []);
  const vibrate = (p: number | number[] = 25) => { if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(p); };
  const setSound = () => { const value = !sound; setSoundState(value); localStorage.setItem(SOUND, value ? "1" : "0"); if (value) cue("ok", true); };
  useEffect(() => { pushToast = (message) => { setNotice(message); window.setTimeout(() => setNotice(""), 2800); }; }, []);
  useEffect(() => { try { const saved = localStorage.getItem(SESSION); if (saved) setSession(JSON.parse(saved)); const last = localStorage.getItem(LAST_SESSION); if (last) setLastSession(JSON.parse(last)); setSoundState(localStorage.getItem(SOUND) !== "0"); const query = location.hash.includes("?") ? location.hash.slice(location.hash.indexOf("?") + 1) : ""; const room = new URLSearchParams(query).get("room") ?? ""; if (/^\d{6}$/.test(room)) { setJoinCode(room); setMode("join"); } const tg = window.Telegram?.WebApp; tg?.ready?.(); tg?.expand?.(); } catch { localStorage.removeItem(LAST_SESSION); } finally { setHydrated(true); } }, []);
  const refresh = useCallback(async () => { if (!session) return; try { const r = await fetch(`${API}?playerId=${encodeURIComponent(session.playerId)}&token=${encodeURIComponent(session.token)}`, { cache: "no-store", headers: initHeaders() }); const data = await r.json() as Game & { error?: string }; if (r.status === 404) { localStorage.removeItem(SESSION); localStorage.removeItem(LAST_SESSION); setSession(null); setLastSession(null); setGame(null); toast.error("Станция закрыта. Создайте новую или войдите по коду."); return; } if (!r.ok) throw new Error(data.error); setGame(data); setOffline(false); } catch { setOffline(true); } }, [session]);
  useEffect(() => { if (!session) return; void refresh(); const id = window.setInterval(() => void refresh(), 2200); return () => clearInterval(id); }, [refresh, session]);
  useEffect(() => { if (!game) return; const key = `${game.room.phase}-${game.room.round}`; if (lastPhase.current === key) return; document.querySelector(".app")?.scrollTo({ top: 0, behavior: "auto" }); if (lastPhase.current) { cue(game.room.phase === "council" || game.room.winner === "infected" ? "alarm" : "ok"); vibrate(game.room.phase === "council" ? [50, 40, 80] : 30); } lastPhase.current = key; }, [cue, game]);
  const enter = async () => { setBusy(true); cue("tap"); try { const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json", ...initHeaders() }, body: JSON.stringify({ mode, name, code: joinCode }) }); const data = await r.json() as { session?: Session; error?: string }; if (!r.ok || !data.session) throw new Error(data.error ?? "Не удалось подключиться"); localStorage.setItem(SESSION, JSON.stringify(data.session)); localStorage.removeItem(LAST_SESSION); setLastSession(null); setSession(data.session); setGame(null); trackEvent(mode === "create" ? "infected_create" : "infected_join", { gameId: "infected" }); cue("ok"); vibrate(); } catch (e) { toast.error(e instanceof Error ? e.message : "Не удалось подключиться"); cue("alarm"); } finally { setBusy(false); } };
  const act = useCallback(async (action: string, payload: Record<string, unknown> = {}) => { if (!session) return; setBusy(true); cue(action === "vote" || action === "council" ? "alarm" : "tap"); try { const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json", ...initHeaders() }, body: JSON.stringify({ mode: "action", playerId: session.playerId, token: session.token, action, payload }) }); const data = await r.json() as Game & { error?: string }; if (!r.ok) throw new Error(data.error ?? "Команда не выполнена"); setGame(data); setOffline(false); if (action === "start") trackEvent("infected_start", { gameId: "infected" }); vibrate(action === "dark" ? [30, 35, 60] : 25); } catch (e) { toast.error(e instanceof Error ? e.message : "Команда не выполнена"); cue("alarm"); } finally { setBusy(false); } }, [cue, session]);
  const exit = () => { if (session) { localStorage.setItem(LAST_SESSION, JSON.stringify(session)); setLastSession(session); } localStorage.removeItem(SESSION); setSession(null); setGame(null); setOffline(false); lastPhase.current = ""; };
  const resume = () => { if (!lastSession) return; localStorage.setItem(SESSION, JSON.stringify(lastSession)); localStorage.removeItem(LAST_SESSION); setSession(lastSession); setLastSession(null); setGame(null); };
  const share = async () => { if (!game) return; const url = `${location.origin}${location.pathname}#/infected?room=${game.room.code}`; const text = `Станция K-17. Код входа: ${game.room.code}`; try { if (navigator.share) await navigator.share({ title: "Заражённые", text, url }); else await navigator.clipboard.writeText(`${text}\n${url}`); toast.success("Код готов к отправке"); } catch { try { await navigator.clipboard.writeText(game.room.code); toast.success("Код скопирован"); } catch { toast.info(text); } } };
  if (!hydrated) return <Loader />;
  let screen = null;
  if (game) { const p = { game, busy, act }; screen = game.room.phase === "lobby" ? <Lobby {...p} share={share} /> : game.room.phase === "briefing" ? <Briefing {...p} /> : game.room.phase === "operations" ? <Operations {...p} /> : game.room.phase === "council" ? <Council {...p} /> : game.room.phase === "result" ? <Result {...p} /> : <End {...p} />; }
  return <main className={`game-shell ${session ? "in-game" : "at-home"}`} onPointerDown={() => { void audio.current?.resume(); }}><div className="station-art" /><div className="station-vignette" /><div className="scanlines" />{notice && <div className="inf-toast" role="status">{notice}</div>}
    {!session ? <Home name={name} setName={setName} code={joinCode} setCode={setJoinCode} mode={mode} setMode={setMode} busy={busy} enter={() => void enter()} sound={sound} setSound={setSound} premiumOpen={premiumOpen} setPremiumOpen={setPremiumOpen} lastSession={lastSession} resume={resume} /> : !game ? <div className="game-stage loading-stage"><Loader />{offline && <div className="connection-error"><TriangleAlert /><p>Не удаётся связаться со станцией.</p><Button onClick={() => void refresh()}><RefreshCw />Повторить</Button><button onClick={exit}>Выйти из комнаты</button></div>}</div> : <div className="game-stage"><Header game={game} sound={sound} setSound={setSound} exit={exit} />{offline && <div className="offline-pill"><TriangleAlert />Связь нестабильна — восстанавливаем</div>}{screen}</div>}
  </main>;
}
