import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { Assignments, PackProgress, Player, Screen, Situation, SituationPack } from "./whoIsWhoTypes";
import {
  drawFromPack,
  getPackProgress,
  loadPackProgressMap,
  nextUncompletedPackNumber,
  playedInPack,
  progressPercent,
  resetPackProgress,
  savePackProgressMap,
  type PackProgressMap,
} from "./whoIsWhoPackProgress";
import { getPackById, SITUATION_PACKS, SITUATIONS_PER_PACK } from "./whoIsWhoPacks";
import { getRoleIconStyle } from "./whoIsWhoUi";
import {
  JUSTIFY_SECONDS,
  MIN_PLAYERS,
  PLAYER_COUNT_OPTIONS,
  clampPlayerCount,
  createId,
  initPlayerSlotsFromStorage,
  resizePlayerNames,
  rolesForPlayerCount,
  savePlayers,
  type PlayerCountOption,
} from "./whoIsWhoUtils";
import { useBack } from "../../hooks/useBack";
import HomeButton from "../../components/HomeButton";
import BackButton from "../../components/BackButton";
import GamesPageHeader from "../../components/GamesPageHeader";
import PremiumOverlay from "../../components/PremiumOverlay";
import { useGameStartGate } from "../../hooks/useGameStartGate";
import "./WhoIsWhoGame.css";

const SELECTED_PACK_KEY = "who-is-who:selected-pack";

function loadSelectedPackId(): string {
  try {
    const raw = localStorage.getItem(SELECTED_PACK_KEY);
    if (raw && getPackById(raw)) return raw;
  } catch {
    /* ignore */
  }
  return SITUATION_PACKS[0].id;
}

function saveSelectedPackId(packId: string): void {
  try {
    localStorage.setItem(SELECTED_PACK_KEY, packId);
  } catch {
    /* ignore */
  }
}

function packStatusLabel(progress: PackProgress): string {
  if (progress.completed) return "Пройден";
  const played = playedInPack(progress);
  if (played === 0) return "Не начат";
  return `${played}/${SITUATIONS_PER_PACK}`;
}

export default function WhoIsWhoGame() {
  const handleBackToGames = useBack("/games");
  const initialSetup = useMemo(() => initPlayerSlotsFromStorage(), []);

  const [screen, setScreen] = useState<Screen>("start");
  const [playerCount, setPlayerCount] = useState<PlayerCountOption>(
    initialSetup.count
  );
  const [playerNames, setPlayerNames] = useState<string[]>(initialSetup.names);
  const [players, setPlayers] = useState<Player[]>([]);
  const [packProgressMap, setPackProgressMap] = useState<PackProgressMap>(() =>
    loadPackProgressMap()
  );
  const [selectedPackId, setSelectedPackId] = useState(loadSelectedPackId);
  const [activePack, setActivePack] = useState<SituationPack | null>(null);
  const [situation, setSituation] = useState<Situation | null>(null);
  const [assignments, setAssignments] = useState<Assignments>({});
  const { startLocked, premiumOverlayOpen, closePremiumOverlay, gatedStart, startCtaClassName } =
    useGameStartGate("who-is-who");

  const selectedPack = useMemo(
    () => getPackById(selectedPackId) ?? SITUATION_PACKS[0],
    [selectedPackId]
  );

  const selectedProgress = useMemo(
    () => getPackProgress(packProgressMap, selectedPack.id),
    [packProgressMap, selectedPack.id]
  );

  const filledNames = playerNames.filter((n) => n.trim().length > 0).length;
  const canStartNames =
    playerNames.length === playerCount &&
    playerNames.every((n) => n.trim().length > 0);

  const playerById = useMemo(() => {
    const map = new Map<string, Player>();
    players.forEach((p) => map.set(p.id, p));
    return map;
  }, [players]);

  const persistProgress = useCallback((map: PackProgressMap) => {
    setPackProgressMap(map);
    savePackProgressMap(map);
  }, []);

  const activeProgress = activePack
    ? getPackProgress(packProgressMap, activePack.id)
    : null;

  function goToSetup() {
    if (players.length > 0) {
      const count = clampPlayerCount(players.length);
      setPlayerCount(count);
      setPlayerNames(resizePlayerNames(players.map((p) => p.name), count));
    }
    setScreen("start");
  }

  function handleSelectPack(packId: string) {
    setSelectedPackId(packId);
    saveSelectedPackId(packId);
  }

  function handlePlayerCount(count: PlayerCountOption) {
    setPlayerCount(count);
    setPlayerNames((prev) => resizePlayerNames(prev, count));
  }

  function handlePlayerName(index: number, value: string) {
    setPlayerNames((prev) =>
      prev.map((name, i) => (i === index ? value : name))
    );
  }

  function commitPlayers() {
    const nextPlayers = playerNames.map((name) => ({
      id: createId(),
      name: name.trim(),
    }));
    setPlayers(nextPlayers);
    savePlayers(nextPlayers);
    return nextPlayers;
  }

  function beginRound(pack: SituationPack, progress: PackProgressMap) {
    const current = getPackProgress(progress, pack.id);
    const { situation: nextSituation, progress: nextProgress } = drawFromPack(
      pack,
      current
    );
    persistProgress({ ...progress, [pack.id]: nextProgress });
    setActivePack(pack);
    setSituation(nextSituation);
    setAssignments({});
    setScreen("round");
  }

  function handleStartGame(replayCompleted = false) {
    if (!canStartNames) return;

    let progress = packProgressMap;
    const packProgress = getPackProgress(progress, selectedPack.id);

    if (packProgress.completed) {
      if (!replayCompleted) return;
      const fresh = resetPackProgress(selectedPack.id);
      progress = { ...progress, [selectedPack.id]: fresh };
      persistProgress(progress);
    }

    commitPlayers();
    beginRound(selectedPack, progress);
  }

  function handleNextSituation() {
    if (!activePack) return;

    const current = getPackProgress(packProgressMap, activePack.id);
    if (current.remainingIndices.length === 0) {
      setScreen("seasonComplete");
      return;
    }

    const { situation: nextSituation, progress: nextProgress } = drawFromPack(
      activePack,
      current
    );

    persistProgress({ ...packProgressMap, [activePack.id]: nextProgress });
    setSituation(nextSituation);
    setAssignments({});
    setScreen("round");
  }

  function handleReplayPack() {
    const fresh = resetPackProgress(selectedPack.id);
    persistProgress({ ...packProgressMap, [selectedPack.id]: fresh });
    if (players.length === 0) {
      commitPlayers();
    }
    beginRound(selectedPack, { ...packProgressMap, [selectedPack.id]: fresh });
  }

  function handlePickAnotherPack() {
    goToSetup();
  }

  function handleGoToNextPack() {
    const nextNum = nextUncompletedPackNumber(packProgressMap, SITUATION_PACKS);
    if (nextNum == null) {
      goToSetup();
      return;
    }
    const nextPack = SITUATION_PACKS.find((p) => p.number === nextNum);
    if (!nextPack) {
      goToSetup();
      return;
    }
    handleSelectPack(nextPack.id);
    goToSetup();
  }

  function handleAssign(roleKey: string, playerId: string) {
    setAssignments((prev) => ({ ...prev, [roleKey]: playerId }));
  }

  const completedPacksCount = SITUATION_PACKS.filter(
    (p) => getPackProgress(packProgressMap, p.id).completed
  ).length;

  return (
    <>
      {screen === "start" && (
        <SetupScreen
          playerCount={playerCount}
          playerNames={playerNames}
          filledNames={filledNames}
          canStartNames={canStartNames}
          packs={SITUATION_PACKS}
          packProgressMap={packProgressMap}
          selectedPackId={selectedPackId}
          selectedProgress={selectedProgress}
          completedPacksCount={completedPacksCount}
          onPlayerCount={handlePlayerCount}
          onPlayerName={handlePlayerName}
          onSelectPack={handleSelectPack}
          startLocked={startLocked}
          startCtaClassName={startCtaClassName}
          onStartGame={() => gatedStart(() => handleStartGame(false))}
          onReplayPack={() => gatedStart(() => handleStartGame(true))}
          onBack={handleBackToGames}
        />
      )}
      <PremiumOverlay isOpen={premiumOverlayOpen} onClose={closePremiumOverlay} />

      {screen === "round" && situation && activePack && activeProgress && (
        <RoundScreen
          pack={activePack}
          packPlayed={playedInPack(activeProgress)}
          situation={situation}
          players={players}
          assignments={assignments}
          onAssign={handleAssign}
          onBack={goToSetup}
          onShowResult={() => setScreen("result")}
        />
      )}

      {screen === "result" && situation && activePack && activeProgress && (
        <ResultScreen
          pack={activePack}
          packPlayed={playedInPack(activeProgress)}
          situation={situation}
          playerCount={players.length}
          assignments={assignments}
          playerById={playerById}
          isLastInPack={activeProgress.remainingIndices.length === 0}
          onBack={() => setScreen("round")}
          onNext={handleNextSituation}
          onChangePlayers={goToSetup}
        />
      )}

      {screen === "seasonComplete" && activePack && (
        <SeasonCompleteScreen
          pack={activePack}
          completedPacksCount={completedPacksCount}
          nextPackNumber={nextUncompletedPackNumber(
            packProgressMap,
            SITUATION_PACKS
          )}
          onReplay={handleReplayPack}
          onPickAnother={handlePickAnotherPack}
          onNextPack={handleGoToNextPack}
          onBack={goToSetup}
        />
      )}
    </>
  );
}

/* ----------------------------- Оболочка ----------------------------- */

function GamePage({
  title,
  tagline,
  onBack,
  backDisabled,
  onBeforeHomeNavigate,
  children,
  actions,
  className,
}: {
  title: string;
  tagline?: string;
  onBack?: () => void;
  backDisabled?: boolean;
  onBeforeHomeNavigate?: () => boolean;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`game-page wiw-game game-page--enter${className ? ` ${className}` : ""}`}>
      <div className="game-page__top">
        <HomeButton className="game-page__nav-btn" onBeforeNavigate={onBeforeHomeNavigate} />
        {!backDisabled && onBack && (
          <BackButton onClick={onBack} className="game-page__nav-btn game-page__back" />
        )}
      </div>

      <GamesPageHeader title={title} tagline={tagline ?? ""} />

      {children}

      {actions && <div className="game-page__actions">{actions}</div>}
    </div>
  );
}

function GameAboutCard() {
  return (
    <div className="wiw-how game-page__panel game-page__panel--glow-b">
      <section className="wiw-how__block">
        <h3 className="wiw-how__title">Что это за игра?</h3>
        <p className="wiw-how__lead">
          «Кто тут кто?» — домашняя игра для компании от {MIN_PLAYERS} до 5 человек.
          Вы читаете смешную ситуацию из жизни — поездка на дачу, спор у мангала,
          провал в общем чате — и решаете, кто из ваших друзей больше всего похож
          на каждого героя этой сцены. Роли абсурдные, оправдания — на вашей совести.
        </p>
      </section>

      <section className="wiw-how__block">
        <h3 className="wiw-how__title">Как играть</h3>
        <ol className="wiw-how__list wiw-how__list--ordered">
          <li>Выберите сезон, укажите число игроков и введите имена.</li>
          <li>
            Прочитайте ситуацию вслух — так понятнее и смешнее. Ролей будет столько
            же, сколько игроков за столом.
          </li>
          <li>
            Каждой роли назначьте игрока из списка. Можно договориться, кто
            распределяет роли, или делать это вместе.
          </li>
          <li>
            Нажмите «Показать итог». Каждый назначенный игрок по очереди
            оправдывается: почему именно он попал в эту роль.
          </li>
          <li>
            На оправдание — {JUSTIFY_SECONDS} секунд. Остальные могут хихикать,
            перебивать и голосовать за лучшее выступление — правила дома решаете вы.
          </li>
          <li>Переходите к следующей ситуации.</li>
        </ol>
      </section>
    </div>
  );
}

/* ----------------------------- Старт ----------------------------- */

interface SetupScreenProps {
  playerCount: PlayerCountOption;
  playerNames: string[];
  filledNames: number;
  canStartNames: boolean;
  packs: SituationPack[];
  packProgressMap: PackProgressMap;
  selectedPackId: string;
  selectedProgress: ReturnType<typeof getPackProgress>;
  completedPacksCount: number;
  onPlayerCount: (count: PlayerCountOption) => void;
  onPlayerName: (index: number, value: string) => void;
  onSelectPack: (packId: string) => void;
  startLocked: boolean;
  startCtaClassName: string;
  onStartGame: () => void;
  onReplayPack: () => void;
  onBack: () => void;
}

function SetupScreen({
  playerCount,
  playerNames,
  filledNames,
  canStartNames,
  packs,
  packProgressMap,
  selectedPackId,
  selectedProgress,
  completedPacksCount,
  onPlayerCount,
  onPlayerName,
  onSelectPack,
  startLocked,
  startCtaClassName,
  onStartGame,
  onReplayPack,
  onBack,
}: SetupScreenProps) {
  const needMore = playerCount - filledNames;
  const packDone = selectedProgress.completed;
  const played = playedInPack(selectedProgress);
  const selectedPack = packs.find((p) => p.id === selectedPackId) ?? packs[0];

  return (
    <GamePage
      title="Кто тут кто?"
      tagline={`30 сезонов · ${SITUATIONS_PER_PACK} ситуаций в каждом · пройдено ${completedPacksCount}/30`}
      onBack={onBack}
      actions={
        packDone ? (
          <div className="wiw-setup-actions">
            <button
              type="button"
              className={startCtaClassName}
              disabled={!startLocked && !canStartNames}
              onClick={onReplayPack}
            >
              Пройти сезон заново
            </button>
            <p className="wiw-setup-actions__hint game-page__hint">
              Или выберите другой сезон ниже
            </p>
          </div>
        ) : (
          <button
            type="button"
            className={startCtaClassName}
            disabled={!startLocked && !canStartNames}
            onClick={onStartGame}
          >
            {!canStartNames
              ? needMore === 1
                ? "Заполните ещё 1 имя"
                : `Заполните ещё ${needMore} имени`
              : played > 0
                ? `Продолжить · ${played}/${SITUATIONS_PER_PACK}`
                : "Начать игру"}
          </button>
        )
      }
    >
      <GameAboutCard />

      <section className="wiw-section game-page__section">
        <h2 className="game-page__section-title">
          Сезоны
          <span className="wiw-section__title-accent">
            {" "}
            · {packStatusLabel(selectedProgress)}
          </span>
        </h2>

        {selectedPack.coverImage && (
          <div className="wiw-pack-hero game-page__panel game-page__panel--glow-a">
            <img
              src={selectedPack.coverImage}
              alt=""
              className="wiw-pack-hero__image"
            />
            <div className="wiw-pack-hero__body">
              <p className="wiw-pack-hero__label">Сезон {selectedPack.number}</p>
              <h3 className="wiw-pack-hero__title">{selectedPack.title}</h3>
              <p className="wiw-pack-hero__subtitle">{selectedPack.subtitle}</p>
            </div>
          </div>
        )}

        {packDone && (
          <div className="wiw-pack-done-banner game-page__panel game-page__panel--glow-b" role="status">
            <span className="wiw-pack-done-banner__icon" aria-hidden>
              ✓
            </span>
            <div>
              <p className="wiw-pack-done-banner__title">Этот сезон вы уже прошли</p>
              <p className="wiw-pack-done-banner__text">
                Все {SITUATIONS_PER_PACK} ситуаций сыграны. Можно пройти сезон заново
                или выбрать другой.
              </p>
            </div>
          </div>
        )}

        <div className="wiw-pack-grid">
          {packs.map((pack) => {
            const prog = getPackProgress(packProgressMap, pack.id);
            const isSelected = pack.id === selectedPackId;
            const done = prog.completed;
            const packPlayed = playedInPack(prog);
            return (
              <button
                key={pack.id}
                type="button"
                className={`wiw-pack-card${pack.coverImage ? " wiw-pack-card--has-cover" : ""}${isSelected ? " wiw-pack-card--active" : ""}${done ? " wiw-pack-card--done" : ""}`}
                onClick={() => onSelectPack(pack.id)}
                aria-pressed={isSelected}
              >
                {pack.coverImage ? (
                  <span className="wiw-pack-card__inner">
                    <img
                      src={pack.coverImage}
                      alt=""
                      className="wiw-pack-card__cover"
                    />
                    <span className="wiw-pack-card__cover-shade" aria-hidden />
                    <span className="wiw-pack-card__content">
                      <span className="wiw-pack-card__num">{pack.number}</span>
                      <span className="wiw-pack-card__title">{pack.title}</span>
                      <span className="wiw-pack-card__progress">
                        {packStatusLabel(prog)}
                      </span>
                    </span>
                    {!done && packPlayed > 0 && (
                      <span
                        className="wiw-pack-card__bar"
                        style={{ width: `${progressPercent(prog)}%` }}
                        aria-hidden
                      />
                    )}
                    {done && (
                      <span className="wiw-pack-card__badge" aria-hidden>
                        ✓
                      </span>
                    )}
                  </span>
                ) : (
                  <>
                    <span className="wiw-pack-card__emoji" aria-hidden>
                      {pack.emoji}
                    </span>
                    <span className="wiw-pack-card__num">{pack.number}</span>
                    <span className="wiw-pack-card__title">{pack.title}</span>
                    <span className="wiw-pack-card__progress">
                      {packStatusLabel(prog)}
                    </span>
                    {!done && packPlayed > 0 && (
                      <span
                        className="wiw-pack-card__bar"
                        style={{ width: `${progressPercent(prog)}%` }}
                        aria-hidden
                      />
                    )}
                    {done && (
                      <span className="wiw-pack-card__badge" aria-hidden>
                        ✓
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="wiw-section game-page__section">
        <h2 className="game-page__section-title">Количество игроков</h2>
        <div className="game-page__chip-row" role="group" aria-label="Количество игроков">
          {PLAYER_COUNT_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              className={`game-page__chip${playerCount === n ? " is-active" : ""}`}
              aria-pressed={playerCount === n}
              onClick={() => onPlayerCount(n)}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="game-page__hint">Минимум {MIN_PLAYERS} человека</p>
      </section>

      <section className="wiw-section game-page__section">
        <h2 className="game-page__section-title">
          Имена игроков ({filledNames}/{playerCount})
        </h2>
        <ul className="wiw-slots">
          {playerNames.map((name, index) => (
            <li key={index} className="wiw-slots__item">
              <label className="wiw-slots__label" htmlFor={`player-${index}`}>
                Игрок {index + 1}
              </label>
              <input
                id={`player-${index}`}
                className="game-page__input wiw-input--slot"
                type="text"
                placeholder={`Имя игрока ${index + 1}`}
                value={name}
                maxLength={20}
                autoComplete="off"
                onChange={(e) => onPlayerName(index, e.target.value)}
              />
            </li>
          ))}
        </ul>
      </section>
    </GamePage>
  );
}

/* ----------------------------- Раунд ----------------------------- */

function RoundScreen({
  pack,
  packPlayed,
  situation,
  players,
  assignments,
  onAssign,
  onBack,
  onShowResult,
}: {
  pack: SituationPack;
  packPlayed: number;
  situation: Situation;
  players: Player[];
  assignments: Assignments;
  onAssign: (roleKey: string, playerId: string) => void;
  onBack: () => void;
  onShowResult: () => void;
}) {
  const activeRoles = rolesForPlayerCount(situation.roles, players.length);
  const assignedCount = activeRoles.filter((_, i) =>
    Boolean(assignments[String(i)])
  ).length;
  const allAssigned = assignedCount === activeRoles.length;

  return (
    <GamePage
      title="Кто тут кто?"
      tagline={`Сезон ${pack.number} «${pack.title}» · ситуация ${packPlayed}/${SITUATIONS_PER_PACK}`}
      onBack={onBack}
      actions={
        <button
          type="button"
          className="game-page__cta"
          disabled={!allAssigned}
          onClick={onShowResult}
        >
          {allAssigned ? "Показать итог" : "Выберите игрока для каждой роли"}
        </button>
      }
    >
      <div className="wiw-pack-run-progress game-page__panel game-page__panel--glow-a">
        <div className="wiw-pack-run-progress__head">
          <span>
            {pack.emoji} Сезон {pack.number}
          </span>
          <span>
            {packPlayed}/{SITUATIONS_PER_PACK}
          </span>
        </div>
        <div className="wiw-pack-run-progress__track">
          <div
            className="wiw-pack-run-progress__fill"
            style={{ width: `${(packPlayed / SITUATIONS_PER_PACK) * 100}%` }}
          />
        </div>
      </div>

      <div className="wiw-situation game-page__panel game-page__panel--glow-b">
        <span className="wiw-situation__badge">Ситуация</span>
        <p className="wiw-situation__text">{situation.situation}</p>
      </div>

      <section className="wiw-section game-page__section">
        <h2 className="game-page__section-title">Роли</h2>
        <ul className="wiw-roles">
          {activeRoles.map((role, index) => {
            const roleKey = String(index);
            const icon = getRoleIconStyle(index);
            const assigned = Boolean(assignments[roleKey]);
            return (
              <li
                key={roleKey}
                className={`wiw-role game-page__panel game-page__panel--glow-a${assigned ? " wiw-role--done" : ""}`}
              >
                <div className="wiw-role__head">
                  <span className={`wiw-role__emoji wiw-role__emoji--${icon.variant}`}>
                    {roleEmoji(icon.icon)}
                  </span>
                  <span className="wiw-role__name">{role}</span>
                </div>
                <select
                  className="wiw-select"
                  value={assignments[roleKey] ?? ""}
                  onChange={(e) => onAssign(roleKey, e.target.value)}
                >
                  <option value="" disabled>
                    Выбрать игрока
                  </option>
                  {players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              </li>
            );
          })}
        </ul>
      </section>
    </GamePage>
  );
}

function roleEmoji(icon: string): string {
  const map: Record<string, string> = {
    local_fire_department: "🔥",
    psychology: "🧠",
    visibility_off: "👻",
    photo_camera: "📸",
    emoji_people: "🕺",
    nightlife: "🎉",
    mic: "🎤",
    sports_bar: "🍻",
  };
  return map[icon] ?? "🎭";
}

/* ----------------------------- Итог ----------------------------- */

function ResultScreen({
  pack,
  packPlayed,
  situation,
  playerCount,
  assignments,
  playerById,
  isLastInPack,
  onBack,
  onNext,
  onChangePlayers,
}: {
  pack: SituationPack;
  packPlayed: number;
  situation: Situation;
  playerCount: number;
  assignments: Assignments;
  playerById: Map<string, Player>;
  isLastInPack: boolean;
  onBack: () => void;
  onNext: () => void;
  onChangePlayers: () => void;
}) {
  const activeRoles = rolesForPlayerCount(situation.roles, playerCount);

  return (
    <GamePage
      title="Итог раунда"
      tagline={`Сезон ${pack.number} · ${packPlayed}/${SITUATIONS_PER_PACK}`}
      onBack={onBack}
      actions={
        <div className="wiw-result-actions">
          <button type="button" className="game-page__cta" onClick={onNext}>
            {isLastInPack ? "Завершить сезон" : "Следующая ситуация"}
          </button>
          <button type="button" className="game-page__btn game-page__btn--secondary" onClick={onChangePlayers}>
            Меню игры
          </button>
        </div>
      }
    >
      <div className="wiw-situation game-page__panel game-page__panel--glow-b wiw-situation--compact">
        <span className="wiw-situation__badge">Ситуация</span>
        <p className="wiw-situation__text">{situation.situation}</p>
      </div>

      <ul className="wiw-verdict">
        {activeRoles.map((role, index) => {
          const player = playerById.get(assignments[String(index)]);
          const icon = getRoleIconStyle(index);
          return (
            <li key={index} className="wiw-verdict__item game-page__panel game-page__panel--glow-a">
              <div className="wiw-verdict__role">
                <span className={`wiw-role__emoji wiw-role__emoji--${icon.variant}`}>
                  {roleEmoji(icon.icon)}
                </span>
                <span>{role}</span>
              </div>
              <span className="wiw-verdict__player">{player?.name ?? "—"}</span>
            </li>
          );
        })}
      </ul>

      <p className="wiw-timer-hint game-page__panel game-page__panel--glow-b">
        ⏱️ Каждый выбранный игрок оправдывается за {JUSTIFY_SECONDS} секунд
      </p>
    </GamePage>
  );
}

/* ----------------------------- Сезон пройден ----------------------------- */

function SeasonCompleteScreen({
  pack,
  completedPacksCount,
  nextPackNumber,
  onReplay,
  onPickAnother,
  onNextPack,
  onBack,
}: {
  pack: SituationPack;
  completedPacksCount: number;
  nextPackNumber: number | null;
  onReplay: () => void;
  onPickAnother: () => void;
  onNextPack: () => void;
  onBack: () => void;
}) {
  return (
    <div className="game-page wiw-game wiw-game--celebrate game-page--enter">
      <div className="wiw-celebrate__glow" aria-hidden />
      <div className="game-page__top">
        <HomeButton className="game-page__nav-btn" />
        <BackButton onClick={onBack} className="game-page__nav-btn game-page__back" />
      </div>

      <div className="wiw-celebrate game-page__panel game-page__panel--glow-b">
        <span className="wiw-celebrate__emoji" aria-hidden>
          {pack.emoji}
        </span>
        <p className="wiw-celebrate__label">Сезон пройден</p>
        <h2 className="wiw-celebrate__title">
          {pack.number} {pack.title}
        </h2>
        <p className="wiw-celebrate__score">
          {SITUATIONS_PER_PACK}/{SITUATIONS_PER_PACK} ситуаций
        </p>
        <p className="wiw-celebrate__text">
          Вы прошли все ситуации этого сезона. Можно пройти его заново или перейти
          к следующему.
        </p>
        <p className="wiw-celebrate__meta">
          Всего пройдено сезонов: {completedPacksCount} из 30
        </p>
      </div>

      <div className="game-page__actions wiw-celebrate__actions">
        {nextPackNumber != null && (
          <button type="button" className="game-page__cta" onClick={onNextPack}>
            Следующий сезон · {nextPackNumber}
          </button>
        )}
        <button type="button" className="game-page__btn game-page__btn--secondary" onClick={onReplay}>
          Пройти этот сезон заново
        </button>
        <button type="button" className="game-page__btn game-page__btn--secondary" onClick={onPickAnother}>
          Выбрать другой сезон
        </button>
      </div>
    </div>
  );
}
