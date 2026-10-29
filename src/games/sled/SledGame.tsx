import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useBack } from "../../hooks/useBack";
import { usePremium } from "../../contexts/PremiumContext";
import { hapticSelection } from "../../utils/haptics";
import HomeButton from "../../components/HomeButton";
import BackButton from "../../components/BackButton";
import PremiumOverlay from "../../components/PremiumOverlay";
import {
  Archive,
  AudioLines,
  Bot,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Copy,
  Clock3,
  Crosshair,
  DoorOpen,
  Eye,
  Fingerprint,
  Headphones,
  LoaderCircle,
  LockKeyhole,
  Link2,
  Map as MapIcon,
  Maximize2,
  MessageSquare,
  Radio,
  Quote,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Siren,
  Smartphone,
  Sparkles,
  Timer,
  TriangleAlert,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { caseCatalog } from "./lib/case-catalog";
import { gameCases, investigationMarks, type CaseId, type DistrictId } from "./lib/game-cases";
import { caseStories, seasonPremise } from "./lib/season-story";
import {
  createInitialSharedState,
  roleById,
  type GameMode,
  type RoomStatus,
  type SharedGameState,
} from "./lib/multiplayer";
import { Button } from "./components/ui/button";
import { CompanionScreen } from "./components/companion-screen";
import { JoinRoomDialog } from "./components/join-room-dialog";
import { RoleIcon } from "./components/role-icon";
import { SceneTransition, type SceneTransitionData } from "./components/scene-transition";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog";
import { Progress } from "./components/ui/progress";
import { Input } from "./components/ui/input";
import { Switch } from "./components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { useGameAudio } from "./hooks/use-game-audio";
import { useRoom } from "./hooks/use-room";
import {
  cityMapSources,
  evidenceSizes,
  evidenceSrcSet,
  hostikSources,
  preferredEvidenceSource,
} from "./lib/image-performance";
import { sledAsset } from "./lib/sled-assets";

type Screen = "intro" | "archive" | "rules" | "lobby" | "game" | "final";
type PanelId = "map" | "evidence" | "dossier" | "chat";

const bootLines = [
  "ИНИЦИАЛИЗАЦИЯ ПРОТОКОЛА СЛЕД 0.1…",
  "КАНАЛ КАРТЫ ПОДКЛЮЧЁН [OK]",
  "ПРОВЕРКА ЗАЩИЩЁННОЙ КОМНАТЫ [OK]",
  "СИНХРОНИЗАЦИЯ УЛИК [OK]",
  "ПОИСК НЕИЗВЕСТНОГО СИГНАЛА…",
  "ВСЕ 10 ДЕЛ СЕЗОНА ДОСТУПНЫ",
];

const caseIcons = [
  Fingerprint,
  Radio,
  ShieldCheck,
  AudioLines,
  Crosshair,
  Eye,
  Sparkles,
  Users,
  TriangleAlert,
  Bot,
];

const modeSettings: Record<GameMode, { name: string; time: number; timed: boolean; wrongPenalty: number; description: string }> = {
  story: {
    name: "Сюжетный",
    time: 75,
    timed: false,
    wrongPenalty: 8,
    description: "Без поражения по времени: читайте вступление и сопоставляйте улики спокойно.",
  },
  operative: {
    name: "Оперативный",
    time: 75,
    timed: true,
    wrongPenalty: 14,
    description: "75 секунд на сцену после кнопки «Начать расследование». Отсчёт общий. Ноль — потеря сигнала.",
  },
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const rest = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function StoryAccent({ text, accent }: { text: string; accent: string }) {
  const accentIndex = text.indexOf(accent);
  if (accentIndex < 0) return <>{text}</>;

  return (
    <>
      {text.slice(0, accentIndex)}
      <strong className="story-highlight">{text.slice(accentIndex, accentIndex + accent.length)}</strong>
      {text.slice(accentIndex + accent.length)}
    </>
  );
}

function publicAbilityText(effect: string) {
  if (effect === "eliminate_district") return "Убран один ложный район.";
  if (effect === "reveal_detail") return "Открыта скрытая связка.";
  if (effect === "extra_time") return "На таймер добавлено время.";
  if (effect === "free_hint") return "Открыта общая подсказка.";
  if (effect === "reduce_threat") return "Угроза снижена.";
  return "Проверка применена.";
}

function resetPageScroll() {
  if (typeof window === "undefined") return;
  const moveToTop = () => {
    const appScroll = document.querySelector(".app") as HTMLElement | null;
    if (appScroll) appScroll.scrollTop = 0;
  };

  moveToTop();
  window.requestAnimationFrame(moveToTop);
}

export default function SledGame() {
  const {
    session,
    room,
    connection,
    error: roomError,
    busy: roomBusy,
    createRoom,
    joinRoom,
    updateRoom,
    setReady,
    vote,
    triggerAbility,
    leaveRoom,
  } = useRoom();
  const handleBackToGames = useBack("/games");
  const { isPremium } = usePremium();
  const [premiumOverlayOpen, setPremiumOverlayOpen] = useState(false);
  const [screen, setScreen] = useState<Screen>("intro");
  const [selectedCaseId, setSelectedCaseId] = useState<CaseId>("01");
  const [bootCount, setBootCount] = useState(0);
  const [mode, setMode] = useState<GameMode>("operative");
  const [hostName, setHostName] = useState("Ведущий");
  const [joinOpen, setJoinOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [panel, setPanel] = useState<PanelId>("map");
  const [roundIndex, setRoundIndex] = useState(0);
  const [signalOpen, setSignalOpen] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictId | null>(null);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [threat, setThreat] = useState(28);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(75);
  const [timerDeadline, setTimerDeadline] = useState<number | null>(null);
  const [analystRounds, setAnalystRounds] = useState<number[]>([]);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [finalChoice, setFinalChoice] = useState<DistrictId | null>(null);
  const [analysisByRound, setAnalysisByRound] = useState<Record<number, number[]>>({});
  const [focus, setFocus] = useState(2);
  const [hintsUsed, setHintsUsed] = useState<number[]>([]);
  const [abilityUsed, setAbilityUsed] = useState(false);
  const [eliminatedDistricts, setEliminatedDistricts] = useState<DistrictId[]>([]);
  const [deductionsSolved, setDeductionsSolved] = useState<number[]>([]);
  const [wrongDeductionsByRound, setWrongDeductionsByRound] = useState<Record<number, number[]>>({});
  const [casePoints, setCasePoints] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageRetry, setImageRetry] = useState(0);
  const [networkFailed, setNetworkFailed] = useState(false);
  const [processedAbilityEventIds, setProcessedAbilityEventIds] = useState<number[]>([]);
  const [abilityNotice, setAbilityNotice] = useState<string | null>(null);
  const [sceneTransition, setSceneTransition] = useState<SceneTransitionData | null>(null);
  const [imageZoomOpen, setImageZoomOpen] = useState(false);
  const syncTimeoutRef = useRef<number | null>(null);
  const sceneTimerRef = useRef<number | null>(null);
  const sceneActionRef = useRef<(() => void) | null>(null);
  const previousPlayerCountRef = useRef(0);
  const previousVoteCountRef = useRef(0);
  const lastRoomEventRef = useRef(0);
  const hostHydratedRef = useRef(false);
  const syncReadyRef = useRef(false);

  const gameCase = gameCases[selectedCaseId];
  const gameStory = caseStories[selectedCaseId];
  const { soundOn, setSoundOn, playSound } = useGameAudio({
    ambientEnabled: screen !== "intro" && screen !== "final",
    profile: gameCase.signalSound,
  });
  const districts = gameCase.districts;
  const rounds = gameCase.rounds;
  const currentRound = rounds[roundIndex];
  const currentStory = gameStory.beats[roundIndex];
  const hasUnknownSuspect = selectedCaseId === "01";
  const dossierImage = hasUnknownSuspect
    ? sledAsset("/game/unknown-suspect-dossier.webp")
    : sledAsset(rounds[0].image);
  const dossierImageWidth = hasUnknownSuspect ? 820 : rounds[0].imageWidth;
  const dossierImageHeight = hasUnknownSuspect ? 1025 : rounds[0].imageHeight;
  const ActiveCaseIcon = caseIcons[Number(selectedCaseId) - 1] ?? Eye;
  const currentMode = modeSettings[mode];
  const currentAnalysis = useMemo(() => analysisByRound[roundIndex] ?? [], [analysisByRound, roundIndex]);
  const currentMarks = useMemo(() => investigationMarks(currentRound), [currentRound]);
  const investigationLive = mode === "operative" && signalOpen && !resolved && timerDeadline != null;
  const secondsLeft = investigationLive && timerDeadline != null
    ? Math.max(0, Math.ceil((timerDeadline - Math.max(clockNow, Date.now())) / 1000))
    : null;
  const currentDeductionSolved = deductionsSolved.includes(roundIndex);
  const currentDeductionErrors = wrongDeductionsByRound[roundIndex] ?? [];
  const selected = districts.find((district) => district.id === selectedDistrict);
  const caseSolved = !networkFailed && finalChoice === gameCase.final.correct && score >= 2 && threat < 100;
  const liveVotes = room?.players
    .filter((player) => player.voteRound === roundIndex && player.voteDistrict)
    .map((player) => ({ agent: player.name.slice(0, 1).toUpperCase(), name: player.name, district: player.voteDistrict! })) ?? [];
  const currentVotes = session ? liveVotes : gameCase.teamVotes[roundIndex].map((vote) => ({ ...vote, name: "Тренировка" }));
  const onlineCount = room?.players.filter((player) => player.online).length ?? 0;
  const currentRole = roleById(room?.me.roleId ?? "operative");
  const roomCode = room?.code;
  const totalPoints = casePoints + (caseSolved ? 200 : 0);
  const outcomeRank = caseSolved
    ? totalPoints >= 520 && threat < 45 ? "S" : totalPoints >= 400 ? "A" : "B"
    : score >= 2 ? "C" : "D";
  const hostikMessage = !signalOpen
    ? "Таймер не идёт, пока вы читаете сцену и роли. Нажмите «Начать расследование», когда команда готова."
    : currentAnalysis.length < 2
      ? "Перейди в улику и найди две светящиеся детали на изображении."
      : !currentDeductionSolved
        ? "Детали собраны. Теперь свяжи их в правильный вывод."
        : resolved
          ? lastCorrect
            ? "Отлично! След подтверждён — можно переходить к следующему сигналу."
            : "Ошибка тоже даёт информацию. Запомни верный сектор и двигайся дальше."
          : "Версия готова. Сверь голоса команды и выбери район на карте.";

  const sharedGameState = useMemo<SharedGameState>(() => ({
    roundIndex,
    signalOpen,
    resolved,
    lastCorrect,
    threat,
    score,
    timeLeft,
    timerDeadline,
    analystRounds,
    analysisByRound,
    hintsUsed,
    eliminatedDistricts,
    deductionsSolved,
    casePoints,
    finalChoice,
    networkFailed,
    processedAbilityEventIds,
  }), [
    analysisByRound,
    analystRounds,
    casePoints,
    deductionsSolved,
    eliminatedDistricts,
    finalChoice,
    hintsUsed,
    lastCorrect,
    networkFailed,
    processedAbilityEventIds,
    resolved,
    roundIndex,
    score,
    signalOpen,
    threat,
    timeLeft,
    timerDeadline,
  ]);

  const completeScene = useCallback(() => {
    if (sceneTimerRef.current) window.clearTimeout(sceneTimerRef.current);
    sceneTimerRef.current = null;
    setSceneTransition(null);
    const action = sceneActionRef.current;
    sceneActionRef.current = null;
    action?.();
  }, []);

  const presentScene = useCallback((scene: SceneTransitionData, after?: () => void) => {
    if (sceneTimerRef.current) window.clearTimeout(sceneTimerRef.current);
    sceneActionRef.current = after ?? null;
    setSceneTransition(scene);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    sceneTimerRef.current = window.setTimeout(completeScene, reducedMotion ? 450 : 2100);
  }, [completeScene]);

  const goToScreen = useCallback((nextScreen: Screen) => {
    if (nextScreen === screen) return;
    resetPageScroll();
    setScreen(nextScreen);
  }, [screen]);

  useLayoutEffect(() => {
    resetPageScroll();
  }, [screen, roundIndex]);

  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => { window.history.scrollRestoration = previous; };
  }, []);

  useEffect(() => {
    if (screen !== "intro" || bootCount >= bootLines.length) return;
    const timer = window.setTimeout(() => setBootCount((value) => value + 1), 330);
    return () => window.clearTimeout(timer);
  }, [bootCount, screen]);

  useEffect(() => () => {
    if (sceneTimerRef.current) window.clearTimeout(sceneTimerRef.current);
  }, []);

  useEffect(() => {
    if (!room) {
      previousPlayerCountRef.current = 0;
      previousVoteCountRef.current = 0;
      lastRoomEventRef.current = 0;
      return;
    }
    const playerCount = room.players.length;
    const voteCount = room.players.filter((player) => player.voteRound === roundIndex && player.voteDistrict).length;
    if (previousPlayerCountRef.current > 0 && playerCount > previousPlayerCountRef.current) playSound("radio");
    if (previousVoteCountRef.current > 0 && voteCount > previousVoteCountRef.current) playSound("click");
    previousPlayerCountRef.current = playerCount;
    previousVoteCountRef.current = voteCount;
    const latestEventId = room.events.length ? room.events[room.events.length - 1]?.id ?? 0 : 0;
    if (!session?.isHost && lastRoomEventRef.current > 0 && latestEventId > lastRoomEventRef.current) playSound("success");
    lastRoomEventRef.current = latestEventId;
  }, [playSound, room, roundIndex, session?.isHost]);

  useEffect(() => {
    if (!investigationLive) return;
    const timer = window.setInterval(() => setClockNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [investigationLive]);

  useEffect(() => {
    if (mode !== "operative" || screen !== "game" || !signalOpen || resolved || timerDeadline == null) return;
    const delay = Math.max(0, timerDeadline - Date.now());
    const timeout = window.setTimeout(() => {
      setTimeLeft(0);
      setThreat((value) => clamp(value + modeSettings.operative.wrongPenalty + 3));
      setLastCorrect(false);
      setResolved(true);
      playSound("error");
    }, delay);
    return () => window.clearTimeout(timeout);
  }, [mode, playSound, resolved, screen, signalOpen, timerDeadline]);

  useEffect(() => {
    if (screen !== "game" || threat < 100 || networkFailed) return;
    const timeout = window.setTimeout(() => {
      setNetworkFailed(true);
      setSignalOpen(false);
      goToScreen("final");
      playSound("error");
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [goToScreen, networkFailed, playSound, screen, threat]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const compactViewport = window.matchMedia("(max-width: 760px)").matches;
    const timers: number[] = [];
    const warmImage = (src: string, delay: number) => {
      timers.push(window.setTimeout(() => {
        const preload = new window.Image();
        preload.decoding = "async";
        preload.src = src;
        if (typeof preload.decode === "function") void preload.decode().catch(() => undefined);
      }, delay));
    };

    if (screen === "archive") {
      warmImage(preferredEvidenceSource(rounds[0].image, compactViewport), 550);
    }
    if (screen === "rules") {
      warmImage(preferredEvidenceSource(rounds[0].image, compactViewport), 80);
    }
    if (screen === "lobby") {
      warmImage(compactViewport ? cityMapSources.compact : cityMapSources.desktop, 120);
      warmImage(preferredEvidenceSource(rounds[0].image, compactViewport), 40);
    }
    if (screen === "game" && imageLoaded && roundIndex + 1 < rounds.length) {
      warmImage(preferredEvidenceSource(rounds[roundIndex + 1].image, compactViewport), 420);
    }

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [imageLoaded, roundIndex, rounds, screen, selectedCaseId]);

  useEffect(() => {
    if (!room || !session) return;

    if (!session.isHost) {
      const timer = window.setTimeout(() => {
        setSelectedCaseId(room.caseId);
        setMode(room.mode);
        if (room.status === "lobby" || room.status === "roles") goToScreen("lobby");
        if (room.status === "game") goToScreen("game");
        if (room.status === "final" || room.status === "ended") goToScreen("final");
        if (room.status === "roles" && !room.me.ready) setRoleOpen(true);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    if (hostHydratedRef.current) return;

    const timer = window.setTimeout(() => {
      hostHydratedRef.current = true;
      setSelectedCaseId(room.caseId);
      setMode(room.mode);
      setAbilityUsed(Boolean(room.me.abilityUsed));

      const state = room.state;
      if (state) {
        setRoundIndex(state.roundIndex ?? 0);
        setSignalOpen(Boolean(state.signalOpen));
        setResolved(Boolean(state.resolved));
        setLastCorrect(state.lastCorrect ?? null);
        setThreat(typeof state.threat === "number" ? state.threat : 28);
        setScore(typeof state.score === "number" ? state.score : 0);
        setTimeLeft(typeof state.timeLeft === "number" ? state.timeLeft : modeSettings[room.mode].time);
        setTimerDeadline(typeof state.timerDeadline === "number" ? state.timerDeadline : null);
        setAnalystRounds(Array.isArray(state.analystRounds) ? state.analystRounds.filter((item) => Number.isInteger(item)) : []);
        setAnalysisByRound(state.analysisByRound ?? {});
        setHintsUsed(state.hintsUsed ?? []);
        setEliminatedDistricts(state.eliminatedDistricts ?? []);
        setDeductionsSolved(state.deductionsSolved ?? []);
        setCasePoints(typeof state.casePoints === "number" ? state.casePoints : 0);
        setFinalChoice(state.finalChoice ?? null);
        setNetworkFailed(Boolean(state.networkFailed));
        const knownIds = [
          ...(state.processedAbilityEventIds ?? []),
          ...room.events.filter((event) => event.kind === "ability").map((event) => event.id),
        ];
        setProcessedAbilityEventIds([...new Set(knownIds)].slice(-80));
        setFocus(Math.max(0, 2 - (state.hintsUsed?.length ?? 0)));
      }

      if (room.status === "lobby" || room.status === "roles") goToScreen("lobby");
      else if (room.status === "game") goToScreen("game");
      else if (room.status === "final" || room.status === "ended") goToScreen("final");
      else goToScreen("lobby");

      if (room.status === "roles") setRoleOpen(true);

      // Allow host sync only after local fields match server snapshot.
      window.setTimeout(() => {
        syncReadyRef.current = true;
      }, 0);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [goToScreen, room, session]);

  useEffect(() => {
    if (!session?.isHost || !roomCode || (screen !== "game" && screen !== "final")) return;
    if (!syncReadyRef.current || !hostHydratedRef.current) return;
    if (syncTimeoutRef.current) window.clearTimeout(syncTimeoutRef.current);
    const status: RoomStatus = screen === "final" ? "final" : "game";
    syncTimeoutRef.current = window.setTimeout(() => {
      void updateRoom(status, sharedGameState);
    }, 320);
    return () => {
      if (syncTimeoutRef.current) window.clearTimeout(syncTimeoutRef.current);
    };
  }, [roomCode, screen, session?.isHost, sharedGameState, updateRoom]);

  useEffect(() => {
    if (!session?.isHost || !room || screen !== "game") return;
    if (!syncReadyRef.current) return;
    const pending = room.events.filter(
      (event) => event.kind === "ability" && !processedAbilityEventIds.includes(event.id),
    );
    if (pending.length === 0) return;
    const timer = window.setTimeout(() => {
      const appliedIds: number[] = [];
      for (const event of pending) {
        const eventRound = Number(event.payload.roundIndex ?? -1);
        if (eventRound !== roundIndex || !signalOpen || resolved) {
          // Keep unapplied for a later matching scene; do not swallow the event.
          continue;
        }
        const effect = String(event.payload.effect ?? "");
        let applied = false;
        if (effect === "eliminate_district") {
          const falseDistrict = gameCase.districts.find(
            (district) => district.id !== currentRound.correct && !eliminatedDistricts.includes(district.id),
          );
          if (falseDistrict) {
            setEliminatedDistricts((value) => [...new Set([...value, falseDistrict.id])]);
            if (selectedDistrict === falseDistrict.id) setSelectedDistrict(null);
            applied = true;
          }
        } else if (effect === "reveal_detail") {
          const hint = gameCase.rounds[roundIndex]?.analystHint;
          if (!hint) {
            appliedIds.push(event.id);
            setAbilityNotice("Для этого раунда нет отдельной связки. Способность не меняет улики.");
          } else if (!analystRounds.includes(roundIndex)) {
            setAnalystRounds((value) => [...new Set([...value, roundIndex])]);
            applied = true;
          } else {
            applied = true;
          }
        } else if (effect === "extra_time") {
          if (mode === "operative" && timerDeadline != null) {
            setTimerDeadline((value) => (value ?? Date.now()) + 20_000);
            setTimeLeft((value) => value + 20);
            applied = true;
          }
        } else if (effect === "free_hint") {
          if (!hintsUsed.includes(roundIndex)) {
            setHintsUsed((value) => [...value, roundIndex]);
            applied = true;
          }
        } else if (effect === "reduce_threat") {
          setThreat((value) => clamp(value - 6));
          applied = true;
        }
        if (!applied) continue;
        appliedIds.push(event.id);
        if (event.participantId === session.participantId) setAbilityUsed(true);
        setAbilityNotice(`${event.participantName}: ${publicAbilityText(effect)}`);
        playSound("success");
      }
      if (appliedIds.length > 0) {
        setProcessedAbilityEventIds((value) => [...new Set([...value, ...appliedIds])].slice(-80));
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    analystRounds,
    currentAnalysis,
    currentRound.correct,
    eliminatedDistricts,
    gameCase.districts,
    gameCase.rounds,
    hintsUsed,
    mode,
    playSound,
    processedAbilityEventIds,
    resolved,
    room,
    roundIndex,
    screen,
    selectedDistrict,
    session,
    signalOpen,
    timerDeadline,
  ]);

  useEffect(() => {
    if (!abilityNotice) return;
    const timer = window.setTimeout(() => setAbilityNotice(null), 3600);
    return () => window.clearTimeout(timer);
  }, [abilityNotice]);

  const intelLog = useMemo(
    () => rounds.slice(0, roundIndex + (resolved ? 1 : 0)),
    [resolved, roundIndex, rounds],
  );

  function openArchive() {
    if (!isPremium) {
      hapticSelection();
      setPremiumOverlayOpen(true);
      return;
    }
    playSound("click");
    goToScreen("archive");
  }

  function startCase(caseId: CaseId) {
    playSound("success");
    if (session) leaveRoom();
    hostHydratedRef.current = false;
    syncReadyRef.current = false;
    setSelectedCaseId(caseId);
    setRoundIndex(0);
    setSignalOpen(false);
    setResolved(false);
    setSelectedDistrict(null);
    setLastCorrect(null);
    setThreat(28);
    setScore(0);
    setTimeLeft(currentMode.time);
    setFinalChoice(null);
    setAnalysisByRound({});
    setFocus(2);
    setHintsUsed([]);
    setAbilityUsed(false);
    setEliminatedDistricts([]);
    setDeductionsSolved([]);
    setWrongDeductionsByRound({});
    setCasePoints(0);
    setImageLoaded(false);
    setImageError(false);
    setImageRetry(0);
    setImageZoomOpen(false);
    setNetworkFailed(false);
    setProcessedAbilityEventIds([]);
    setAbilityNotice(null);
    setPanel("map");
    goToScreen("rules");
  }

  async function finishRules() {
    if (!isPremium) {
      hapticSelection();
      setPremiumOverlayOpen(true);
      return;
    }
    try {
      playSound("radio");
      const initialState = createInitialSharedState(currentMode.time);
      hostHydratedRef.current = true;
      syncReadyRef.current = true;
      await createRoom({
        name: hostName,
        caseId: selectedCaseId,
        mode,
        state: initialState,
      });
      setTimeLeft(currentMode.time);
      goToScreen("lobby");
      playSound("success");
    } catch {
      hostHydratedRef.current = false;
      syncReadyRef.current = false;
      playSound("error");
    }
  }

  async function revealRole() {
    playSound("alert");
    if (session?.isHost) await updateRoom("roles", sharedGameState);
    setRoleOpen(true);
  }

  async function acceptRole() {
    playSound("success");
    if (session && !session.isHost) {
      try {
        await setReady(true);
      } catch {
        playSound("error");
        return;
      }
    }
    setRoleOpen(false);
  }

  async function beginInvestigation() {
    if (!session?.isHost) return;
    playSound("success");
    goToScreen("game");
    presentScene({
      eyebrow: `ДЕЛО ${gameCase.id} · ОПЕРАТИВНЫЙ ВХОД`,
      title: currentStory.title,
      location: currentStory.location,
      body: currentStory.setup,
      image: currentRound.image,
      imageWidth: currentRound.imageWidth,
    });
    await updateRoom("game", sharedGameState);
  }

  async function handleJoin(code: string, name: string) {
    const joined = await joinRoom(code, name);
    hostHydratedRef.current = false;
    syncReadyRef.current = false;
    setSelectedCaseId(joined.caseId);
    setMode(joined.mode);
    goToScreen("lobby");
    playSound("success");
  }

  function openSignal() {
    playSound(gameCase.signalSound);
    presentScene({
      eyebrow: `${currentStory.chapter} · ВХОДЯЩИЙ СИГНАЛ`,
      title: currentRound.title,
      location: `${currentStory.location} · ${currentRound.time}`,
      body: currentStory.setup,
      image: currentRound.image,
      imageWidth: currentRound.imageWidth,
    }, () => {
      setSignalOpen(true);
      setPanel("evidence");
      if (mode === "operative") {
        const deadline = Date.now() + modeSettings.operative.time * 1000;
        setTimerDeadline(deadline);
        setTimeLeft(modeSettings.operative.time);
      } else {
        setTimerDeadline(null);
      }
    });
  }

  function analyzeDetail(index: number) {
    if (!signalOpen || resolved || index < 0 || index >= currentRound.details.length || currentAnalysis.includes(index)) return;
    playSound("success");
    setCasePoints((value) => value + 15);
    setAnalysisByRound((value) => ({
      ...value,
      [roundIndex]: [...(value[roundIndex] ?? []), index],
    }));
  }

  function requestHint() {
    if (focus <= 0 || hintsUsed.includes(roundIndex)) return;
    playSound("alert");
    setFocus((value) => value - 1);
    setHintsUsed((value) => [...value, roundIndex]);
    setThreat((value) => clamp(value + 3));
    setCasePoints((value) => Math.max(0, value - 20));
  }

  function solveDeduction(optionIndex: number) {
    if (currentAnalysis.length < 2 || currentDeductionSolved) return;
    if (optionIndex === currentRound.deduction.correct) {
      playSound("success");
      setDeductionsSolved((value) => [...value, roundIndex]);
      setThreat((value) => clamp(value - 2));
      setCasePoints((value) => value + (currentDeductionErrors.length === 0 ? 40 : 20));
      return;
    }
    if (currentDeductionErrors.includes(optionIndex)) return;
    playSound("error");
    setWrongDeductionsByRound((value) => ({
      ...value,
      [roundIndex]: [...(value[roundIndex] ?? []), optionIndex],
    }));
    setThreat((value) => clamp(value + 4));
  }

  async function useRoleAbility() {
    if (abilityUsed || !signalOpen || resolved) return;
    if (session) {
      try {
        await triggerAbility();
      } catch {
        playSound("error");
      }
      return;
    }
    const eliminated = gameCase.abilityEliminations[roundIndex];
    playSound("success");
    setAbilityUsed(true);
    setEliminatedDistricts([eliminated]);
    if (selectedDistrict === eliminated) setSelectedDistrict(null);
  }

  function inspectMap() {
    playSound("click");
    setPanel("map");
  }

  function chooseDistrict(id: DistrictId) {
    if (!signalOpen || resolved || eliminatedDistricts.includes(id)) return;
    playSound("click");
    setSelectedDistrict(id);
  }

  function confirmScan() {
    if (!selectedDistrict || resolved || !currentDeductionSolved) return;
    const isCorrect = selectedDistrict === currentRound.correct;
    const remaining = mode === "operative" && timerDeadline != null
      ? Math.max(0, Math.ceil((timerDeadline - Date.now()) / 1000))
      : 0;
    setLastCorrect(isCorrect);
    setResolved(true);
    if (mode === "operative") setTimeLeft(remaining);
    if (isCorrect) {
      setScore((value) => value + 1);
      setThreat((value) => clamp(value - 7));
      setCasePoints((value) => value + 100 + Math.floor(remaining / 5));
      playSound("success");
    } else {
      setThreat((value) => clamp(value + currentMode.wrongPenalty));
      playSound("error");
    }
    presentScene({
      eyebrow: isCorrect ? "СЛЕД ПОДТВЕРЖДЁН" : "ЛОЖНЫЙ МАРШРУТ",
      title: isCorrect ? currentStory.title : "Контур изменил маршрут",
      location: currentStory.location,
      body: isCorrect ? currentStory.reveal : currentStory.miss,
      image: currentRound.image,
      imageWidth: currentRound.imageWidth,
      tone: isCorrect ? "success" : "danger",
    });
  }

  function nextRound() {
    playSound("click");
    if (roundIndex === rounds.length - 1) {
      goToScreen("final");
      return;
    }
    setRoundIndex((value) => value + 1);
    setSignalOpen(false);
    setTimerDeadline(null);
    setResolved(false);
    setSelectedDistrict(null);
    setLastCorrect(null);
    setTimeLeft(currentMode.time);
    setEliminatedDistricts([]);
    setImageLoaded(false);
    setImageError(false);
    setImageRetry(0);
    setImageZoomOpen(false);
    setPanel("map");
  }

  function makeFinalChoice(id: DistrictId) {
    const solved = id === gameCase.final.correct && score >= 2 && threat < 100;
    setFinalChoice(id);
    playSound(solved ? "success" : "error");
    presentScene({
      eyebrow: solved ? "ФИНАЛЬНЫЙ ПРОТОКОЛ ЗАКРЫТ" : "КАНАЛ НЕ СТАБИЛИЗИРОВАН",
      title: solved ? gameCase.final.successTitle : gameCase.final.failureTitle,
      location: gameCase.operationTitle,
      body: solved ? gameCase.final.successText : gameCase.final.wrongText,
      image: rounds[rounds.length - 1]?.image ?? currentRound.image,
      imageWidth: rounds[rounds.length - 1]?.imageWidth ?? currentRound.imageWidth,
      tone: solved ? "success" : "danger",
    });
  }

  async function restart() {
    playSound("click");
    if (session) {
      if (session.isHost) await updateRoom("ended", sharedGameState);
      leaveRoom();
      hostHydratedRef.current = false;
      syncReadyRef.current = false;
      goToScreen("archive");
    } else {
      goToScreen("lobby");
    }
    setRoundIndex(0);
    setSignalOpen(false);
    setResolved(false);
    setSelectedDistrict(null);
    setLastCorrect(null);
    setThreat(28);
    setScore(0);
    setTimeLeft(currentMode.time);
    setFinalChoice(null);
    setAnalysisByRound({});
    setFocus(2);
    setHintsUsed([]);
    setAbilityUsed(false);
    setEliminatedDistricts([]);
    setDeductionsSolved([]);
    setWrongDeductionsByRound({});
    setCasePoints(0);
    setImageLoaded(false);
    setImageError(false);
    setImageRetry(0);
    setImageZoomOpen(false);
    setNetworkFailed(false);
    setProcessedAbilityEventIds([]);
    setAbilityNotice(null);
    setPanel("map");
  }

  return (
    <main className="sled-root game-shell">
      <div className="noise" aria-hidden="true" />
      {sceneTransition && <SceneTransition scene={sceneTransition} onComplete={completeScene} />}
      {imageZoomOpen && (
        <section className="photo-lightbox" role="dialog" aria-modal="true" aria-label={`Улика крупным планом: ${currentRound.title}`}>
          <div className="photo-lightbox-head">
            <span><Fingerprint /> {currentRound.code} · ОРИГИНАЛ</span>
            <button onClick={() => setImageZoomOpen(false)} aria-label="Закрыть изображение"><X /></button>
          </div>
          <div className="photo-lightbox-canvas">
            <img src={sledAsset(currentRound.image)} width={currentRound.imageWidth} height={currentRound.imageHeight} loading="eager" decoding="async" alt={`Улика крупным планом: ${currentRound.title}`} />
          </div>
          <p>Разведите пальцы, чтобы увеличить изображение</p>
        </section>
      )}
      <div className="game-page sled-nav">
        <div className="game-page__top">
          <HomeButton className="game-page__nav-btn" />
          <BackButton className="game-page__nav-btn" onClick={handleBackToGames} />
        </div>
      </div>
      <header className="topbar">
        <button
          className="brand"
          onClick={() => {
            if (screen === "intro") return;
            playSound("click");
            goToScreen("archive");
          }}
          aria-label="Открыть архив дел"
        >
          <span className="brand-mark"><Fingerprint /></span>
          <span>
            <strong>СЛЕД</strong>
            <small>CASE NETWORK</small>
          </span>
        </button>

        <div className="topbar-status">
          <span className={`network-pill state-${connection}`}>
            {connection === "error" ? <WifiOff /> : <Wifi />}
            {session ? connection === "syncing" ? "СИНХРОНИЗАЦИЯ" : connection === "error" ? "КАНАЛ НАРУШЕН" : `КОМНАТА ${session.code}` : "СЕТЬ ГОТОВА"}
          </span>
          {!session && screen !== "rules" && (
            <button className="header-join" onClick={() => { playSound("click"); setJoinOpen(true); }}><DoorOpen /> ВОЙТИ ПО КОДУ</button>
          )}
          <label className="sound-control">
            {soundOn ? <Volume2 /> : <VolumeX />}
            <span>ЗВУК</span>
            {soundOn && screen !== "intro" && <i className="ambient-led" title="Фоновый звук активен" />}
            <Switch checked={soundOn} onCheckedChange={setSoundOn} aria-label="Включить звук" />
          </label>
        </div>
      </header>

      {screen === "intro" && (
        <section className="intro-screen screen-pad">
          <div className="intro-copy">
            <div className="eyebrow"><Radio /> ЗАЩИЩЁННЫЙ КАНАЛ / 00:17</div>
            <h1>Город оставляет <span>следы.</span><br />Найдите того, кто лжет.</h1>
            <p className="intro-howto">Создай комнату и стань ведущим или присоединяйся к друзьям по коду</p>
            <div className="intro-actions">
              <Button className="primary-action" onClick={openArchive}>
                {isPremium ? <Archive /> : <LockKeyhole />}
                {isPremium ? "СОЗДАТЬ ИГРУ" : "СОЗДАТЬ ИГРУ · PREMIUM"}
                <ChevronRight />
              </Button>
              <Button className="join-action" onClick={() => { playSound("click"); setJoinOpen(true); }}>
                <DoorOpen /> ВОЙТИ ПО КОДУ
              </Button>
              <span className="session-note"><Users /> 3–8 игроков · 15–30 минут на дело</span>
            </div>
            <p className="lead">
              <strong className="story-declaration">ВЫ — КОМАНДА <span>СЛЕД.</span></strong>
              <span>Пропавшая журналистка оставила вам десять дел, ведущих к системе,
                которая стирает память города. В каждой главе исследуйте улики, делайте выводы и выбирайте маршрут —
                каждое решение открывает новую сцену общей истории.</span>
            </p>
          </div>

          <div className="intro-visual" aria-hidden="true">
            <div className="radar">
              <div className="radar-grid" />
              <div className="radar-sweep" />
              <span className="radar-dot dot-one" />
              <span className="radar-dot dot-two" />
              <span className="radar-dot dot-three" />
              <div className="radar-center"><Crosshair /></div>
            </div>
            <img
              className="hostik-intro"
              src={hostikSources.fallback}
              srcSet={hostikSources.srcSet}
              sizes="(max-width: 760px) 150px, 220px"
              width="720"
              height="748"
              loading="eager"
              decoding="async"
              fetchPriority="high"
              alt=""
            />
            <div className="case-stamp"><span>READY</span><strong>10</strong><small>OF 10 CASES</small></div>
          </div>

          <div className="boot-console tactical-panel">
            <div className="console-head"><span>TERMINAL // SLED_OS</span><i>LIVE</i></div>
            <div className="console-lines">
              {bootLines.slice(0, bootCount).map((line, index) => (
                <p key={line} className={index === bootLines.length - 1 ? "hot-line" : ""}>
                  <span>{String(index + 1).padStart(2, "0")}</span>{line}
                </p>
              ))}
              {bootCount < bootLines.length && <b className="cursor" />}
            </div>
          </div>
        </section>
      )}

      {screen === "archive" && (
        <section className="archive-screen screen-pad">
          <div className="archive-hero">
            <div className="archive-heading">
              <div className="eyebrow"><Archive /> СЕЗОН 01 / АРХИВ ИНЦИДЕНТОВ</div>
              <h2>Десять дел.<br /><span>Одна большая тайна.</span></h2>
              <p>
                <StoryAccent text={seasonPremise.description} accent="десять зашифрованных дел" />
              </p>
              <div className="season-mystery"><BookOpen /><div><small>ГЛАВНЫЙ ВОПРОС СЕЗОНА</small><strong>{seasonPremise.question}</strong></div></div>
              <div className="access-model multiplayer-model">
                <Users />
                <div>
                  <small>КОМАНДНЫЙ РЕЖИМ</small>
                  <strong>Один экран ведущего + телефоны игроков</strong>
                  <span>Создайте комнату, покажите код и распределите тайные роли.</span>
                </div>
              </div>
            </div>

            <div className="hostik-archive tactical-panel">
              <img src={hostikSources.fallback} srcSet={hostikSources.srcSet} sizes="210px" width="720" height="748" loading="lazy" decoding="async" alt="Хостик — помощник команды" />
              <div>
                <span><Bot /> ХОСТИК НА СВЯЗИ</span>
                <p>Все десять дел готовы. Можно начать с любой главы, но при прохождении по порядку откроется единая история Евы, Нины и моей потерянной памяти.</p>
              </div>
            </div>
          </div>

          <div className="case-catalog">
            {caseCatalog.map((caseInfo, index) => {
              const CaseIcon = caseIcons[index];
              const isActive = caseInfo.status === "active";
              return (
                <article className={`case-card tactical-panel tone-${caseInfo.tone} ${isActive ? "active" : "production"}`} key={caseInfo.id}>
                  <div className="case-card-top">
                    <span className="case-number">ДЕЛО {caseInfo.id}</span>
                    <span className="case-status">{isActive ? caseInfo.id === "10" ? "ФИНАЛ · ДОСТУПНО" : "СЮЖЕТ · ДОСТУПНО" : "В ПРОИЗВОДСТВЕ"}</span>
                  </div>
                  <div className="case-symbol"><CaseIcon /></div>
                  <small className="case-subtitle">{caseInfo.subtitle}</small>
                  <h3>{caseInfo.title}</h3>
                  <p>{caseInfo.hook}</p>
                  <div className="case-thread"><Link2 /><span><small>НИТЬ СЕЗОНА</small>{caseInfo.thread}</span></div>
                  <div className="case-mechanic">{caseInfo.mechanic}</div>
                  <div className="case-meta">
                    <span><Clock3 /> {caseInfo.duration}</span>
                    <span><Crosshair /> {caseInfo.difficulty}</span>
                  </div>
                  {isActive ? (
                    <Button className="case-launch" onClick={() => startCase(caseInfo.id as CaseId)}>ОТКРЫТЬ ДЕЛО <ChevronRight /></Button>
                  ) : (
                    <div className="case-locked"><LockKeyhole /> Добавим по очереди после полной проверки предыдущего дела</div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {screen === "rules" && (
        <section className="rules-screen screen-pad">
          <div className="rules-heading">
            <div className="eyebrow"><ShieldCheck /> ПРОТОКОЛ ОПЕРАТИВНОЙ ГРУППЫ</div>
            <h2>{gameCase.rulesTitle}</h2>
            <p>{gameCase.rulesGoal} Решения команды меняют темп истории и определяют, успеете ли вы спасти свидетеля.</p>
          </div>

          <article className="story-prologue tactical-panel">
            <div className="story-prologue-icon">
              <img
                src={sledAsset(rounds[0].image)}
                srcSet={evidenceSrcSet(rounds[0].image, rounds[0].imageWidth)}
                sizes="96px"
                width={rounds[0].imageWidth}
                height={rounds[0].imageHeight}
                loading="eager"
                decoding="async"
                alt=""
              />
              <ActiveCaseIcon />
            </div>
            <div className="story-prologue-copy">
              <div className="story-kicker"><BookOpen /> ДЕЛО {gameCase.id} · {gameStory.genre}</div>
              <h3>{gameStory.logline}</h3>
              {gameStory.coldOpen.map((paragraph, index) => (
                <p key={paragraph} className={`story-paragraph story-paragraph-${index + 1}`}>
                  <StoryAccent text={paragraph} accent={gameStory.coldOpenAccents[index]} />
                </p>
              ))}
              <div className="story-mission-grid">
                <div><small>ЗАДАЧА</small><strong>{gameStory.objective}</strong></div>
                <div className="danger"><small>ЕСЛИ ОПОЗДАТЬ</small><strong>{gameStory.stakes}</strong></div>
              </div>
            </div>
            <aside className="story-cast">
              <small>ДЕЙСТВУЮЩИЕ ЛИЦА</small>
              {gameStory.cast.map((person) => (
                <div key={person.name}><span>{person.name.slice(0, 1)}</span><p><strong>{person.name}</strong><small>{person.role}</small><em>{person.note}</em></p></div>
              ))}
            </aside>
          </article>

          <div className="rules-grid">
            <article className="rule-card tactical-panel">
              <span className="rule-number">01</span>
              <div className="rule-icon"><Radio /></div>
              <h3>Откройте сигнал</h3>
              <p>Пока вы читаете вступление, таймер не идёт. Ведущий запускает сцену кнопкой «Начать расследование». В оперативном режиме после этого у всех устройств 75 секунд, ноль — потеря сигнала. В сюжетном режиме время не приводит к поражению.</p>
            </article>
            <article className="rule-card tactical-panel">
              <span className="rule-number">02</span>
              <div className="rule-icon"><Fingerprint /></div>
              <h3>Исследуйте улику</h3>
              <p>Нажимайте на оранжевые метки прямо на изображении. Без анализа нельзя подтвердить версию.</p>
            </article>
            <article className="rule-card tactical-panel">
              <span className="rule-number">03</span>
              <div className="rule-icon"><Sparkles /></div>
              <h3>Сделайте вывод</h3>
              <p>Свяжите найденные детали в одну версию. Ошибочный вывод повышает уровень угрозы.</p>
            </article>
            <article className="rule-card tactical-panel">
              <span className="rule-number">04</span>
              <div className="rule-icon"><Users /></div>
              <h3>Сверьте версии</h3>
              <p>Каждый игрок отмечает район со своего телефона. Ведущий видит голоса, но отвечает за итоговое решение.</p>
            </article>
            <article className="rule-card tactical-panel">
              <span className="rule-number">05</span>
              <div className="rule-icon"><Crosshair /></div>
              <h3>Зафиксируйте район</h3>
              <p>Верный выбор снижает угрозу, а ошибка усиливает противника. После трёх раундов откроется финал.</p>
            </article>
          </div>

          <article className="player-flow tactical-panel">
            <div className="player-flow-heading">
              <span><Smartphone /></span>
              <div>
                <small>ЧТО ДЕЛАЮТ ДРУГИЕ ИГРОКИ</small>
                <h3>Телефон каждого — отдельный пульт оперативника</h3>
                <p>Игроки не просто наблюдают: у каждого есть личная роль, одна особая способность на всё дело и собственный голос за район.</p>
              </div>
            </div>
            <div className="player-flow-steps">
              <div><b>01</b><span><strong>Получить роль</strong><small>Прочитать личную задачу и подтвердить готовность.</small></span></div>
              <div><b>02</b><span><strong>Помочь команде</strong><small>Изучать улику, обсуждать её вслух и вовремя применить способность.</small></span></div>
              <div><b>03</b><span><strong>Проголосовать</strong><small>Выбрать район на телефоне. Ведущий увидит все голоса и примет итоговое решение.</small></span></div>
            </div>
          </article>

          <div className="rules-bottom">
            <div className="mode-select tactical-panel">
              <div className="panel-title"><span><Timer /> ВЫБЕРИТЕ РЕЖИМ</span><b>{currentMode.timed ? `${currentMode.time} СЕК.` : "БЕЗ ЛИМИТА"}</b></div>
              <div className="mode-options">
                {(Object.keys(modeSettings) as GameMode[]).map((item) => (
                  <button
                    key={item}
                    className={mode === item ? "active" : ""}
                    onClick={() => { playSound("click"); setMode(item); setTimeLeft(modeSettings[item].time); }}
                  >
                    <span>{item === "story" ? <Sparkles /> : <Siren />}</span>
                    <div><strong>{modeSettings[item].name}</strong><small>{modeSettings[item].description}</small></div>
                    <i>{modeSettings[item].timed ? `${modeSettings[item].time} СЕК` : "БЕЗ ЛИМИТА"}</i>
                  </button>
                ))}
              </div>
            </div>

            <aside className="resources-card tactical-panel">
              <div className="panel-title"><span><TriangleAlert /> РЕСУРСЫ ДЕЛА</span><b>ОГРАНИЧЕНЫ</b></div>
              <div className="resource-rule"><Sparkles /><p><strong>2 заряда анализа</strong><span>Открывают подсказку, но повышают угрозу на 3%.</span></p></div>
              <div className="resource-rule"><Crosshair /><p><strong>«Проверка» ×1</strong><span>Способность роли навсегда убирает один ложный район.</span></p></div>
              <div className="resource-rule case-rule"><AudioLines /><p><strong>{gameCase.mechanic.name}</strong><span>{gameCase.mechanic.description}</span></p></div>
              <div className="timer-warning"><Timer /><span>Таймер начинается только после открытия сигнала.</span></div>
              <label className="host-name-field">
                <span><Users /> ИМЯ ВЕДУЩЕГО</span>
                <Input value={hostName} onChange={(event) => setHostName(event.target.value.slice(0, 24))} placeholder="Ведущий" />
              </label>
              {roomError && <div className="room-api-error"><WifiOff /> {roomError}</div>}
              <Button className="primary-action wide" disabled={roomBusy || hostName.trim().length < 2} onClick={finishRules}>
                {roomBusy ? <LoaderCircle className="spin" /> : <Radio />}
                {roomBusy ? "СОЗДАЁМ КОМНАТУ…" : "СОЗДАТЬ КОМНАТУ"} <ChevronRight />
              </Button>
            </aside>
          </div>
        </section>
      )}

      {screen === "lobby" && (
        <section className="lobby-screen screen-pad">
          <div className="section-heading">
            <div>
              <div className="eyebrow"><LockKeyhole /> ДЕЛО {gameCase.id} · ЗАЩИЩЁННАЯ КОМНАТА</div>
              <h2>{session?.isHost ? "Соберите оперативную группу" : "Вы подключены к группе"}</h2>
              <p>{room?.status === "roles" ? "Роли распределены. Каждый игрок должен открыть свою карточку и подтвердить готовность." : "Покажите код участникам. Они входят с телефона и указывают своё имя."}</p>
            </div>
            <button
              className="room-code"
              disabled={!room}
              onClick={() => {
                if (!room) return;
                void navigator.clipboard?.writeText(room.code);
                playSound("click");
              }}
              aria-label="Скопировать код комнаты"
            >
              <small>КОД ДОСТУПА <Copy /></small>
              <strong>{room ? room.code.split("").join(" · ") : "— · — · — · — · — · —"}</strong>
            </button>
          </div>

          <div className="lobby-grid">
            <div className="team-panel tactical-panel">
              <div className="panel-title"><span><Users /> УЧАСТНИКИ</span><b>{room ? `${onlineCount}/${room.players.length} В СЕТИ` : "ПОДКЛЮЧЕНИЕ"}</b></div>
              <div className="team-list">
                {!room && <div className="room-loading"><LoaderCircle className="spin" /> Создаём защищённый канал…</div>}
                {room?.players.map((member) => {
                  const isMe = member.id === room.me.id;
                  return (
                    <div className={`team-row ${member.online ? "ready" : "unknown"}`} key={member.id}>
                      <div className="avatar">{member.name.slice(0, 1).toUpperCase()}</div>
                      <div>
                        <strong>{member.name}{isMe ? " · ВЫ" : ""}</strong>
                        <small>{member.isHost ? "Ведущий группы" : isMe && room.status === "roles" ? currentRole.name : "Секретная роль"}</small>
                      </div>
                      <span className={`connection ${member.ready ? "confirmed" : ""}`}>
                        {!member.online ? "НЕ В СЕТИ" : room.status === "lobby" ? "ПОДКЛЮЧЁН" : member.ready ? "ГОТОВ" : "ЧИТАЕТ РОЛЬ"}
                      </span>
                    </div>
                  );
                })}
                {room && room.players.length < 8 && room.status === "lobby" && (
                  <div className="open-seat"><DoorOpen /><span><strong>Свободные места: {8 - room.players.length}</strong><small>Новый игрок появится здесь автоматически.</small></span></div>
                )}
              </div>
              {roomError && <div className="room-api-error"><WifiOff /> {roomError}</div>}
              <div className="sync-explainer"><Wifi /><span><strong>Живая синхронизация</strong><small>Голоса, способности и ход сцены обновляются на всех телефонах.</small></span></div>
            </div>

            <aside className="briefing tactical-panel">
              <div className="panel-title"><span><ShieldCheck /> БРИФИНГ</span><b>ДЕЛО {gameCase.id}</b></div>
              <div className="briefing-art">
                <img
                  src={sledAsset(rounds[0].image)}
                  srcSet={evidenceSrcSet(rounds[0].image, rounds[0].imageWidth)}
                  sizes="(max-width: 760px) calc(100vw - 64px), 330px"
                  width={rounds[0].imageWidth}
                  height={rounds[0].imageHeight}
                  loading="eager"
                  decoding="async"
                  alt={`Первая сцена дела «${gameCase.title}»`}
                />
                <div className="phantom-silhouette"><ActiveCaseIcon /></div><span>{gameStory.genre}</span>
              </div>
              <h3>{gameCase.title}</h3>
              <p className="briefing-logline">{gameStory.logline}</p>
              <div className="briefing-scene"><Quote /><p><StoryAccent text={gameStory.coldOpen[1]} accent={gameStory.coldOpenAccents[1]} /></p></div>
              <div className="briefing-objective"><small>ОПЕРАТИВНАЯ ЦЕЛЬ</small><strong>{gameStory.objective}</strong></div>
              <div className="briefing-stakes"><TriangleAlert /><span><small>СТАВКА ДЕЛА</small>{gameStory.stakes}</span></div>
              <ul>
                <li><span>01</span> Откройте сигнал</li>
                <li><span>02</span> Найдите детали на фото</li>
                <li><span>03</span> Решите задачу дедукции</li>
                <li><span>04</span> Сверьте версии команды</li>
                <li><span>05</span> Выберите район</li>
              </ul>
              <div className="chosen-mode"><Timer /><span>Режим: <strong>{currentMode.name}</strong> · {currentMode.timed ? "75 секунд после старта расследования" : "без поражения по времени"}</span></div>
              <div className="lobby-dock">
              {session?.isHost ? (
                room?.status === "roles" ? (
                  <>
                    <Button className="role-reminder wide" onClick={() => setRoleOpen(true)}><Fingerprint /> ПОКАЗАТЬ МОЮ РОЛЬ</Button>
                    <Button
                      className="primary-action wide"
                      disabled={!room.players.every((player) => player.ready)}
                      onClick={beginInvestigation}
                    >
                      {room.players.every((player) => player.ready) ? "ПЕРЕЙТИ К СЦЕНЕ" : "ЖДЁМ ГОТОВНОСТИ ИГРОКОВ"} <ChevronRight />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button className="primary-action wide" disabled={!room || (room.players.length < 3 || room.players.length > 8)} onClick={revealRole}>
                      {room && room.players.length < 3
                        ? `НУЖНО ЕЩЁ ${3 - room.players.length}. СЕЙЧАС ${room.players.length} ИЗ 3–8`
                        : "РАСПРЕДЕЛИТЬ СЕКРЕТНЫЕ РОЛИ"} <Fingerprint />
                    </Button>
                    {room && room.players.length < 3 && (
                      <p className="session-note">Комнату можно открыть одному. Расследование начинается, когда в группе от 3 до 8 игроков.</p>
                    )}
                  </>
                )
              ) : (
                <>
                  {room?.status === "roles" ? (
                    room.me.ready ? (
                      <div className="guest-ready"><Check /><span><strong>ВЫ ГОТОВЫ</strong><small>После запуска здесь появятся улика, ваша способность и голосование за район.</small></span></div>
                    ) : (
                      <Button className="primary-action wide" onClick={() => setRoleOpen(true)}>ОТКРЫТЬ МОЮ РОЛЬ <Fingerprint /></Button>
                    )
                  ) : (
                    <div className="guest-waiting"><Radio /><span><strong>ОЖИДАЕМ ВЕДУЩЕГО</strong><small>Роль появится на этом экране после распределения.</small></span></div>
                  )}
                  <Button className="leave-action wide" onClick={() => { leaveRoom(); hostHydratedRef.current = false; syncReadyRef.current = false; goToScreen("intro"); }}><X /> ПОКИНУТЬ КОМНАТУ</Button>
                </>
              )}
              </div>
            </aside>
          </div>
        </section>
      )}

      {(screen === "game" || screen === "final") && session && !session.isHost && room && (
        <CompanionScreen
          room={room}
          gameCase={gameCase}
          story={gameStory}
          busy={connection === "syncing"}
          error={roomError}
          onVote={vote}
          onAbility={triggerAbility}
          onLeave={() => { leaveRoom(); hostHydratedRef.current = false; syncReadyRef.current = false; goToScreen("intro"); }}
        />
      )}

      {screen === "game" && (!session || session.isHost) && (
        <section className="case-screen screen-pad">
          {abilityNotice && <div className="ability-toast"><Sparkles /><span>{abilityNotice}</span></div>}
          <div className="case-header">
            <div>
              <div className="eyebrow"><Siren /> ДЕЛО {gameCase.id} / {gameStory.genre.toUpperCase()}</div>
              <h2>{gameCase.operationTitle}</h2>
              <p>{currentStory.chapter} · {currentStory.title}</p>
            </div>
            <div className="case-metrics">
              <div><small>ЭТАП</small><strong>{roundIndex + 1}<span>/3</span></strong></div>
              <div><small>ТОЧНОСТЬ</small><strong>{score}<span> верн.</span></strong></div>
              <div><small>ОЧКИ ДЕЛА</small><strong>{casePoints}<span> XP</span></strong></div>
              <div className="timer-metric">
                <small>{mode === "operative" ? "ДО ПОТЕРИ СИГНАЛА" : "СЮЖЕТНЫЙ РЕЖИМ"}</small>
                <strong>{!signalOpen || resolved ? "--:--" : mode === "operative" ? formatTimer(secondsLeft ?? 0) : "БЕЗ ЛИМИТА"}</strong>
              </div>
            </div>
          </div>

          <div className="threat-strip">
            <div className="threat-label"><span><TriangleAlert /> УРОВЕНЬ УГРОЗЫ</span><strong>{threat}%</strong></div>
            <Progress value={threat} className="threat-progress" />
            <small>{threat < 45 ? gameCase.threatCopy[0] : threat < 75 ? gameCase.threatCopy[1] : gameCase.threatCopy[2]}</small>
          </div>

          <div className="resource-strip">
            <span><Timer /> {currentMode.name.toUpperCase()}</span>
            <span><Sparkles /> ЗАРЯДЫ АНАЛИЗА <strong>{focus}/2</strong></span>
            <span className={abilityUsed ? "spent" : "ready"}><Crosshair /> ПРОВЕРКА <strong>{abilityUsed ? "ИСПОЛЬЗОВАНА" : "ГОТОВА"}</strong></span>
            <span><Fingerprint /> ДЕТАЛИ <strong>{currentAnalysis.length}/{currentMarks.length}</strong></span>
            <span className={currentDeductionSolved ? "ready" : ""}><ShieldCheck /> ВЫВОД <strong>{currentDeductionSolved ? "ГОТОВ" : "НЕ ГОТОВ"}</strong></span>
          </div>

          <div className="case-mechanic-strip">
            <span><AudioLines /> {gameCase.mechanic.name}</span>
            <div>
              {rounds.map((item, index) => (
                <i className={deductionsSolved.includes(index) ? "unlocked" : ""} key={item.code}>
                  {deductionsSolved.includes(index) ? item.trace : `ФРАГМЕНТ 0${index + 1}`}
                </i>
              ))}
            </div>
          </div>

          <div className="story-progress-strip">
            <span><BookOpen /> {currentStory.chapter}</span>
            <strong>{currentStory.location}</strong>
            <p><Link2 /> {currentStory.cliffhanger}</p>
          </div>

          <Tabs value={panel} onValueChange={(value) => { playSound("click"); setPanel(value as PanelId); }} className="case-tabs">
            <TabsList className="case-nav">
              <TabsTrigger value="map"><MapIcon /> <span>КАРТА</span></TabsTrigger>
              <TabsTrigger value="evidence"><Fingerprint /> <span>УЛИКА</span>{signalOpen && !resolved && <i />}</TabsTrigger>
              <TabsTrigger value="dossier"><ShieldCheck /> <span>ДОСЬЕ</span></TabsTrigger>
              <TabsTrigger value="chat"><MessageSquare /> <span>КАНАЛ</span><b>3</b></TabsTrigger>
            </TabsList>

            <TabsContent value="map" className="map-content">
              <div className="map-layout">
                <div className="city-map tactical-panel">
                  <img
                    className="city-map-art"
                    src={cityMapSources.fallback}
                    srcSet={cityMapSources.srcSet}
                    sizes={cityMapSources.sizes}
                    width="1400"
                    height="876"
                    loading="eager"
                    decoding="async"
                    fetchPriority="high"
                    alt="Неоновая карта районов города"
                  />
                  <div className="map-grid" aria-hidden="true" />
                  <div className="river-line" aria-hidden="true" />
                  <span className="map-label label-a">SECTOR / NIGHT</span>
                  <span className="map-label label-b">GRID 41.09</span>
                  {districts.map((district) => {
                    const isSelected = selectedDistrict === district.id;
                    const isCorrect = resolved && district.id === currentRound.correct;
                    const isWrong = resolved && isSelected && !isCorrect;
                    const isEliminated = eliminatedDistricts.includes(district.id);
                    return (
                      <button
                        key={district.id}
                        className={`district tone-${district.tone} ${isSelected ? "selected" : ""} ${isCorrect ? "correct" : ""} ${isWrong ? "wrong" : ""} ${isEliminated ? "eliminated" : ""}`}
                        style={{ left: `${district.x}%`, top: `${district.y}%` }}
                        onClick={() => chooseDistrict(district.id)}
                        disabled={!signalOpen || resolved || isEliminated}
                        aria-label={`Выбрать район ${district.name}`}
                      >
                        <span className="district-pulse" />
                        <b>{district.code}</b>
                        <small>{district.name}</small>
                      </button>
                    );
                  })}
                  {!signalOpen && (
                    <div className="signal-lock story-lock">
                      <div className="story-lock-top"><span><BookOpen /> {currentStory.chapter}</span><b>{currentStory.location}</b></div>
                      <h3>{currentStory.title}</h3>
                      <p>{currentStory.setup}</p>
                      <blockquote><Quote /><span><strong>{currentStory.contactName}</strong><small>{currentStory.contactRole}</small>{currentStory.contactMessage}</span></blockquote>
                      <div className="story-danger"><TriangleAlert /><span><small>ЧТО НА КОНУ</small>{currentStory.stakes}</span></div>
                      <Button className="primary-action" onClick={openSignal}>НАЧАТЬ РАССЛЕДОВАНИЕ <ChevronRight /></Button>
                    </div>
                  )}
                </div>

                <aside className="scan-panel tactical-panel">
                  <div className="panel-title"><span><Crosshair /> СКАНЕР</span><b>{currentRound.code}</b></div>
                  <div className={`scanner-orb ${signalOpen ? "active" : ""}`}><ScanLine /></div>
                  <div className="scan-copy">
                    <small>ВЫБРАННЫЙ СЕКТОР</small>
                    <strong>{selected ? `${selected.code} · ${selected.name}` : "НЕ ВЫБРАН"}</strong>
                    <p>{!signalOpen ? "Сначала прочитайте сцену. Таймер ещё не идёт." : currentAnalysis.length < 2 ? "Исследуйте минимум две метки. Каждая открывает новый факт." : !currentDeductionSolved ? "Вернитесь к улике и свяжите факты." : "Укажите район, который лучше всего соответствует выводу."}</p>
                  </div>
                  <div className="hostik-companion">
                    <img src={hostikSources.fallback} srcSet={hostikSources.srcSet} sizes="90px" width="720" height="748" loading="lazy" decoding="async" alt="Хостик" />
                    <div><span><Bot /> ХОСТИК</span><p>{hostikMessage}</p></div>
                  </div>
                  {signalOpen && !resolved && (
                    <div className="team-consensus">
                      <div><span><Users /> ГОЛОСА ГРУППЫ</span><small>{currentVotes.length}/{room?.players.length ?? 3}</small></div>
                      <div className="vote-list">
                        {currentVotes.map((vote, index) => {
                          const voteDistrict = districts.find((item) => item.id === vote.district)!;
                          return <span key={`${vote.agent}-${index}`} title={vote.name}><i>{vote.agent}</i>{voteDistrict.code}</span>;
                        })}
                        {currentVotes.length === 0 && <em className="no-votes">Игроки ещё обсуждают версию</em>}
                      </div>
                    </div>
                  )}
                  {!resolved ? (
                    <div className="scan-actions">
                      <Button className="ability-action wide" disabled={abilityUsed || room?.me.abilityUsed || !signalOpen} onClick={useRoleAbility}>
                        <Sparkles /> {abilityUsed || room?.me.abilityUsed ? "ПРОВЕРКА ИСПОЛЬЗОВАНА" : "УБРАТЬ ЛОЖНЫЙ РАЙОН"}
                      </Button>
                      <Button className="primary-action wide" disabled={!selectedDistrict || !currentDeductionSolved} onClick={confirmScan}>
                        {currentDeductionSolved ? "ПОДТВЕРДИТЬ ВЕРСИЮ" : "СНАЧАЛА ЗАВЕРШИТЕ ВЫВОД"} <Crosshair />
                      </Button>
                    </div>
                  ) : (
                    <div className={`result-card ${lastCorrect ? "success" : "error"}`}>
                      <div>{lastCorrect ? <Check /> : <X />}</div>
                      <strong>{lastCorrect ? "СЛЕД ПОДТВЕРЖДЁН" : mode === "operative" && timeLeft === 0 ? "СИГНАЛ ПОТЕРЯН" : "ЛОЖНЫЙ МАРШРУТ"}</strong>
                      <p>{lastCorrect ? currentStory.reveal : currentStory.miss}</p>
                      <div className="story-cliffhanger"><BookOpen /><span><small>СЮЖЕТНЫЙ ПОВОРОТ</small>{currentStory.cliffhanger}</span></div>
                      <Button className="next-action" onClick={nextRound}>
                        {roundIndex === rounds.length - 1 ? "ПЕРЕЙТИ К РАЗВЯЗКЕ" : "СЛЕДУЮЩАЯ СЦЕНА"} <ChevronRight />
                      </Button>
                    </div>
                  )}
                </aside>
              </div>
            </TabsContent>

            <TabsContent value="evidence" className="evidence-content">
              {!signalOpen ? (
                <div className="empty-state tactical-panel"><LockKeyhole /><h3>Улика зашифрована</h3><p>Откройте входящий сигнал на карте.</p><Button onClick={() => setPanel("map")}>К КАРТЕ</Button></div>
              ) : (
                <div className="evidence-layout">
                  <div className="evidence-photo tactical-panel" style={{ aspectRatio: `${currentRound.imageWidth} / ${currentRound.imageHeight}` }}>
                    <img
                      key={`${currentRound.image}-${imageRetry}`}
                      src={`${sledAsset(currentRound.image)}${imageRetry ? `?retry=${imageRetry}` : ""}`}
                      srcSet={imageRetry ? undefined : evidenceSrcSet(currentRound.image, currentRound.imageWidth)}
                      sizes={evidenceSizes()}
                      width={currentRound.imageWidth}
                      height={currentRound.imageHeight}
                      loading="eager"
                      decoding="async"
                      fetchPriority="high"
                      className={imageLoaded ? "loaded" : ""}
                      onLoad={() => { setImageLoaded(true); setImageError(false); }}
                      onError={() => { setImageLoaded(false); setImageError(true); }}
                      alt={`Улика: ${currentRound.title}`}
                    />
                    {!imageLoaded && !imageError && <div className="image-loader"><ScanLine /><strong>ЗАГРУЗКА УЛИКИ</strong><span>Оптимизированный канал WebP</span><i /></div>}
                    {imageError && <div className="image-loader error"><TriangleAlert /><strong>КАНАЛ ПРЕРВАН</strong><span>Не удалось получить изображение</span><Button onClick={() => { setImageError(false); setImageRetry((value) => value + 1); }}>ПОВТОРИТЬ</Button></div>}
                    {imageLoaded && <div className="photo-scan" aria-hidden="true" />}
                    {imageLoaded && <button className="photo-zoom" onClick={() => setImageZoomOpen(true)} aria-label="Открыть улику крупным планом"><Maximize2 /> УВЕЛИЧИТЬ</button>}
                    <div className="photo-meta"><span>{currentRound.code}</span><span>{currentRound.time}</span><span>АНАЛИЗ {currentAnalysis.length}/{currentMarks.length}</span></div>
                    {imageLoaded && currentMarks.map((hotspot, index) => (
                      <button
                        key={`${currentRound.code}-${index}`}
                        className={`photo-hotspot ${currentAnalysis.includes(index) ? "revealed" : ""}`}
                        style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
                        onClick={() => analyzeDetail(index)}
                        disabled={!signalOpen || resolved}
                        aria-label={hotspot.action}
                      ><i>{currentAnalysis.includes(index) ? <Check /> : `0${index + 1}`}</i></button>
                    ))}
                    {imageLoaded && currentAnalysis.length < currentMarks.length && <div className="photo-instruction"><Fingerprint /> НАЖМИТЕ НА МЕТКИ — КАЖДАЯ ОТКРОЕТ НОВЫЙ ФАКТ</div>}
                  </div>
                  <aside className="evidence-notes tactical-panel">
                    <div className="panel-title"><span><Fingerprint /> АНАЛИЗ УЛИКИ</span><b>{currentAnalysis.length}/{currentMarks.length}</b></div>
                    <small className="source">{currentRound.source}</small>
                    <h3>{currentRound.title}</h3>
                    <p>{currentRound.summary}</p>
                    <div className="detail-list">
                      {currentRound.details.map((detail, index) => {
                        const revealed = currentAnalysis.includes(index);
                        const action = currentMarks[index]?.action ?? "Исследуйте метку на фотографии";
                        return <div key={detail} className={revealed ? "revealed" : "locked"}><span>{revealed ? `0${index + 1}` : <LockKeyhole />}</span><p>{revealed ? detail : action}</p></div>;
                      })}
                    </div>
                    <div className={`deduction-card ${currentDeductionSolved ? "solved" : ""} ${currentAnalysis.length < 2 ? "locked" : ""}`}>
                      <div className="deduction-head"><span><ShieldCheck /> ЛОГИЧЕСКИЙ ВЫВОД</span><b>{currentDeductionSolved ? "+ВЕРСИЯ" : currentAnalysis.length < 2 ? "ЗАБЛОКИРОВАН" : "ВЫБЕРИТЕ"}</b></div>
                      {currentAnalysis.length < 2 ? (
                        <p className="deduction-locked"><LockKeyhole /> Сначала сопоставьте минимум две метки. Каждая открывает новый факт.</p>
                      ) : (
                        <>
                          <h4>{currentRound.deduction.question}</h4>
                          <div className="deduction-options">
                            {currentRound.deduction.options.map((option, index) => {
                              const isWrong = currentDeductionErrors.includes(index);
                              const isCorrect = currentDeductionSolved && index === currentRound.deduction.correct;
                              return <button key={option} className={`${isWrong ? "wrong" : ""} ${isCorrect ? "correct" : ""}`} disabled={currentDeductionSolved || isWrong} onClick={() => solveDeduction(index)}><span>{String.fromCharCode(65 + index)}</span>{option}{isCorrect && <Check />}{isWrong && <X />}</button>;
                            })}
                          </div>
                          {currentDeductionSolved && <div className="deduction-success"><Check /><p><strong>Вывод подтверждён</strong>{currentRound.deduction.success}</p></div>}
                          {!currentDeductionSolved && currentDeductionErrors.length > 0 && <small className="deduction-warning"><TriangleAlert /> Версия не связывает все найденные детали. Попробуйте ещё раз: +4% угрозы.</small>}
                        </>
                      )}
                    </div>
                    {hintsUsed.includes(roundIndex) ? (
                      <div className="hostik-hint revealed"><div><Sparkles /></div><p><strong>Хостик:</strong> {currentRound.hint}</p></div>
                    ) : (
                      <Button className="hint-action wide" disabled={focus === 0} onClick={requestHint}><CircleHelp /> {focus > 0 ? "ПОДСКАЗКА: −1 ЗАРЯД, +3% УГРОЗЫ" : "ЗАРЯДЫ ЗАКОНЧИЛИСЬ"}</Button>
                    )}
                    <Button className="primary-action wide" disabled={!currentDeductionSolved} onClick={inspectMap}>{currentDeductionSolved ? "ОТМЕТИТЬ РАЙОН НА КАРТЕ" : "СНАЧАЛА СДЕЛАЙТЕ ВЫВОД"} <MapIcon /></Button>
                  </aside>
                </div>
              )}
            </TabsContent>

            <TabsContent value="dossier">
              <div className="dossier-layout">
                <div className="suspect-card tactical-panel">
                  <div className={`suspect-photo ${hasUnknownSuspect ? "unknown-human" : "case-subject"}`}>
                    <img
                      src={dossierImage}
                      srcSet={hasUnknownSuspect ? undefined : evidenceSrcSet(rounds[0].image, dossierImageWidth)}
                      sizes="(max-width: 760px) calc(100vw - 60px), 360px"
                      width={dossierImageWidth}
                      height={dossierImageHeight}
                      loading="lazy"
                      decoding="async"
                      alt={hasUnknownSuspect ? "Засекреченный портрет неизвестного Фантома" : `Материал досье: ${gameCase.target.name}`}
                    />
                    <i className="suspect-scan" aria-hidden="true" />
                    <div className="suspect-photo-label">
                      <small>{hasUnknownSuspect ? "БИОМЕТРИЯ ИСКАЖЕНА" : gameCase.target.code}</small>
                      <strong>{gameCase.target.label}</strong>
                    </div>
                  </div>
                  <div className="suspect-info"><small>{gameCase.target.code}</small><h3>{gameCase.target.name}</h3><p>{gameCase.target.description}</p></div>
                </div>
                <div className="intel-stack tactical-panel">
                  <div className="panel-title"><span><AudioLines /> ЖУРНАЛ РАЗВЕДДАННЫХ</span><b>{intelLog.length}/{rounds.length}</b></div>
                  <div className="season-thread-card"><Link2 /><p><small>СВЯЗЬ С СЕЗОНОМ</small>{gameStory.seasonThread}</p></div>
                  {intelLog.length === 0 ? <div className="no-intel">Пока нет подтверждённых сигналов.</div> : intelLog.map((item, index) => (
                    <div className="intel-row" key={item.code}><span>0{index + 1}</span><div><strong>{item.title}</strong><small>{item.code} · {item.time}</small><em>{item.trace}</em></div><Check /></div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="chat">
              <div className="channel-layout tactical-panel">
                <div className="channel-head"><div><Headphones /><span><strong>ГРУППОВОЙ КАНАЛ</strong><small>События комнаты синхронизированы</small></span></div><b><i /> {onlineCount || 1} В СЕТИ</b></div>
                <div className="messages">
                  <div className="message system"><Radio /><div><small>БРИФИНГ · ЗАЩИЩЁННЫЙ КАНАЛ</small><p>{gameCase.chatIntro[0]}</p></div></div>
                  <div className="message system"><Users /><div><small>КОМАНДА · РЕКОМЕНДАЦИЯ</small><p>{gameCase.chatIntro[1]}</p></div></div>
                  <div className="message story-message"><span className="avatar mini story">{currentStory.contactName.slice(0, 1)}</span><div><small>{currentStory.contactName.toUpperCase()} · {currentStory.contactRole.toUpperCase()}</small><p>{currentStory.contactMessage}</p></div></div>
                  {room?.events.filter((event) => event.kind === "ability").map((event) => (
                    <div className="message system success" key={event.id}><Sparkles /><div><small>{event.participantName.toUpperCase()} · ПРОВЕРКА</small><p>{publicAbilityText(String(event.payload.effect ?? ""))}</p></div></div>
                  ))}
                  {signalOpen && <div className="message system"><Radio /><div><small>СИСТЕМА · {currentRound.time}</small><p>В канал добавлена улика {currentRound.code}.</p></div></div>}
                  {currentAnalysis.length > 0 && <div className="message system"><Fingerprint /><div><small>АНАЛИЗ · СЕЙЧАС</small><p>Обнаружено деталей: {currentAnalysis.length}/{currentMarks.length}. Данные добавлены в общее дело.</p></div></div>}
                  {currentDeductionSolved && <div className="message system success"><ShieldCheck /><div><small>ДЕДУКЦИЯ · ПОДТВЕРЖДЕНО</small><p>{currentRound.deduction.success}</p></div></div>}
                  {hintsUsed.includes(roundIndex) && <div className="message"><span className="avatar mini hostik">Х</span><div><small>ХОСТИК · ЗАЩИЩЁННЫЙ КАНАЛ</small><p>{currentRound.hint}</p></div></div>}
                  {resolved && <div className="message"><span className="avatar mini">В</span><div><small>ВЫ · СЕЙЧАС</small><p>{lastCorrect ? currentStory.reveal : currentStory.miss}</p></div></div>}
                  {resolved && <div className="message system cliff"><BookOpen /><div><small>СЮЖЕТ · НОВЫЕ ДАННЫЕ</small><p>{currentStory.cliffhanger}</p></div></div>}
                </div>
                <div className="fake-input"><span>Обсуждение идёт вслух, а голоса и способности фиксируются автоматически</span><Button disabled><Wifi /> LIVE</Button></div>
              </div>
            </TabsContent>
          </Tabs>
        </section>
      )}

      {screen === "final" && (!session || session.isHost) && (
        <section className="final-screen screen-pad">
          {!finalChoice && !networkFailed ? (
            <div className="final-choice-wrap">
              <div className="eyebrow"><Crosshair /> ФИНАЛЬНЫЙ ПРОТОКОЛ</div>
              <h2>{gameCase.final.question}</h2>
              <p>{gameCase.final.description}</p>
              <div className="final-story-stakes"><TriangleAlert /><span><small>ПОСЛЕДСТВИЯ РЕШЕНИЯ</small>{gameStory.stakes}</span></div>
              <div className="final-stats"><span><small>ТОЧНЫХ ВЕРСИЙ</small><strong>{score}/{rounds.length}</strong></span><span><small>УРОВЕНЬ УГРОЗЫ</small><strong>{threat}%</strong></span><span><small>ОЧКИ ДЕЛА</small><strong>{casePoints}</strong></span></div>
              <div className="final-options">
                {gameCase.final.choices.map((id) => {
                  const district = districts.find((item) => item.id === id)!;
                  return <button key={id} onClick={() => makeFinalChoice(id)}><span>{district.code}</span><MapIcon /><strong>{district.name}</strong><small>ПОДТВЕРДИТЬ ТОЧКУ</small></button>;
                })}
              </div>
              <div className="hostik-hint final-hint"><div><CircleHelp /></div><p><strong>Последняя проверка:</strong> {gameCase.final.hint}</p></div>
            </div>
          ) : (
              <div className={`ending-card tactical-panel ${caseSolved ? "won" : "lost"}`}>
              <div className="ending-emblem">{caseSolved ? <ShieldCheck /> : <TriangleAlert />}</div>
              <div className="eyebrow">ДЕЛО {gameCase.id} / ПРОТОКОЛ ЗАВЕРШЁН</div>
              <h2>{caseSolved ? gameCase.final.successTitle : networkFailed ? "СЕТЬ ПОТЕРЯНА" : gameCase.final.failureTitle}</h2>
              <p>{caseSolved ? gameCase.final.successText : threat >= 100 ? gameCase.final.networkLostText : finalChoice === gameCase.final.correct ? gameCase.final.insufficientText : gameCase.final.wrongText}</p>
              {caseSolved && (
                <div className="ending-story">
                  <div><BookOpen /><p><small>ПРАВДА ДЕЛА</small>{gameStory.finale.truth}</p></div>
                  <div><ShieldCheck /><p><small>ВОССТАНОВЛЕНО</small>{gameStory.finale.recovered}</p></div>
                  <div><ChevronRight /><p><small>ДАЛЬШЕ</small>{gameStory.finale.next}</p></div>
                </div>
              )}
              <div className="ending-grid"><div><small>ТОЧНОСТЬ</small><strong>{score}/{rounds.length}</strong></div><div><small>УГРОЗА</small><strong>{threat}%</strong></div><div><small>ОЧКИ</small><strong>{totalPoints}</strong></div><div><small>РЕЙТИНГ</small><strong>{outcomeRank}</strong></div></div>
              <Button className="primary-action" onClick={restart}><RotateCcw /> СЫГРАТЬ ЕЩЁ РАЗ</Button>
            </div>
          )}
        </section>
      )}

      <footer className="ticker">
        <div><span>СЛЕД // ГОРОДСКОЙ КАНАЛ</span><i /> {session ? `КОМНАТА ${session.code}` : "НОЧНАЯ СМЕНА АКТИВНА"} <i /> CASE {gameCase.id}: {gameCase.title.toUpperCase()} <i /> {connection === "error" ? "СВЯЗЬ НАРУШЕНА" : "СИГНАЛ СТАБИЛЕН"}</div>
      </footer>

      <PremiumOverlay isOpen={premiumOverlayOpen} onClose={() => setPremiumOverlayOpen(false)} />
      <JoinRoomDialog
        open={joinOpen}
        busy={roomBusy}
        error={roomError}
        onOpenChange={setJoinOpen}
        onJoin={handleJoin}
      />

      <Dialog open={roleOpen} onOpenChange={setRoleOpen}>
        <DialogContent
          showCloseButton={false}
          className="role-dialog"
        >
          <DialogHeader>
            <div className="role-security"><LockKeyhole /> ТОЛЬКО ДЛЯ ВАС</div>
            <DialogTitle>СЕКРЕТНАЯ РОЛЬ</DialogTitle>
            <DialogDescription>Эта карточка видна только на вашем телефоне. Не раскрывайте способность до её применения.</DialogDescription>
          </DialogHeader>
          <div className="role-card">
            <div className="role-icon"><RoleIcon icon={currentRole.icon} /></div>
            <small>ПОЗЫВНОЙ «{currentRole.callSign}»</small>
            <h3>{currentRole.name.toUpperCase()}</h3>
            <p>{currentRole.mission}</p>
            <div className="ability"><Sparkles /><span><strong>СПОСОБНОСТЬ «{currentRole.abilityName.toUpperCase()}»</strong>{currentRole.abilityDescription}</span></div>
            <div className="role-howto">
              <small>ЧТО ИМЕННО ВАМ ДЕЛАТЬ</small>
              <div><b>01</b><p><strong>ВАША ЗОНА ВНИМАНИЯ</strong>{currentRole.guide.responsibility}</p></div>
              <div><b>02</b><p><strong>КОГДА НАЖАТЬ СПОСОБНОСТЬ</strong>{currentRole.guide.useWhen}</p></div>
              <div><b>03</b><p><strong>ЧТО ПРОИЗОЙДЁТ</strong>{currentRole.guide.result}</p></div>
            </div>
            <div className="role-common-rule"><Users /><span><strong>ОБЩЕЕ ДЛЯ ВСЕХ ИГРОКОВ</strong>Обсуждайте улику вслух, применяйте способность в нужный момент, затем голосуйте за район. Итог фиксирует ведущий.</span></div>
          </div>
          <DialogFooter>
            <Button className="primary-action wide" onClick={acceptRole}>РОЛЬ ПРИНЯТА · Я ГОТОВ <ShieldCheck /></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
