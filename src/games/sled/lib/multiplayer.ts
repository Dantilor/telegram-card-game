import type { CaseId, DistrictId } from "./game-cases";

export type GameMode = "story" | "operative";
export type RoomStatus = "lobby" | "roles" | "game" | "final" | "ended";
export type ConnectionState = "offline" | "connecting" | "synced" | "syncing" | "error";

export type RoleEffect =
  | "eliminate_district"
  | "reveal_detail"
  | "extra_time"
  | "free_hint"
  | "reduce_threat";

export type PlayerRole = {
  id: string;
  name: string;
  callSign: string;
  icon: "crosshair" | "scan" | "eye" | "radio" | "archive" | "shield" | "timer" | "profile";
  mission: string;
  abilityName: string;
  abilityDescription: string;
  effect: RoleEffect;
  guide: {
    responsibility: string;
    useWhen: string;
    result: string;
    buttonLabel: string;
  };
};

export const playerRoles: PlayerRole[] = [
  {
    id: "operative",
    name: "Оперативник",
    callSign: "ВЕКТОР",
    icon: "crosshair",
    mission: "Соберите версии группы и зафиксируйте итоговый район.",
    abilityName: "Проверка",
    abilityDescription: "Один раз за дело исключает ложный район в текущей сцене.",
    effect: "eliminate_district",
    guide: {
      responsibility: "Слушайте версии игроков и сравнивайте их с уликой на своём экране.",
      useWhen: "Когда команда сомневается между несколькими районами.",
      result: "Один неверный район исчезнет с карты у ведущего.",
      buttonLabel: "ИСКЛЮЧИТЬ ЛОЖНЫЙ РАЙОН",
    },
  },
  {
    id: "analyst",
    name: "Аналитик",
    callSign: "СПЕКТР",
    icon: "scan",
    mission: "Ищите малозаметные детали и связывайте их в единый вывод.",
    abilityName: "Глубокий анализ",
    abilityDescription: "Один раз за дело открывает отдельную связку фактов текущего раунда. Её нет среди общих меток, и она не называет ответ.",
    effect: "reveal_detail",
    guide: {
      responsibility: "Сопоставляйте факты и расскажите команде, что именно стоит сравнить.",
      useWhen: "После старта расследования — и до меток, и после них. Если связки нет, кнопка не тратит способность.",
      result: "Только вы увидите, что узнали и что обсудить. Общие метки не изменятся.",
      buttonLabel: "ОТКРЫТЬ СКРЫТУЮ СВЯЗКУ",
    },
  },
  {
    id: "observer",
    name: "Наблюдатель",
    callSign: "СОВА",
    icon: "eye",
    mission: "Следите за окружением и отмечайте несовпадения в версиях.",
    abilityName: "Слепая зона",
    abilityDescription: "Один раз за дело убирает с карты район, не связанный со следом.",
    effect: "eliminate_district",
    guide: {
      responsibility: "Ищите в фотографии фон, вывески, освещение и другие несостыковки.",
      useWhen: "Когда на карте осталось несколько правдоподобных вариантов.",
      result: "Один ложный район исчезнет с карты у ведущего.",
      buttonLabel: "УБРАТЬ ЛОЖНЫЙ РАЙОН",
    },
  },
  {
    id: "signaler",
    name: "Связист",
    callSign: "ЭХО",
    icon: "radio",
    mission: "Удерживайте канал и помогайте команде не потерять темп.",
    abilityName: "Чистый канал",
    abilityDescription: "Один раз за дело добавляет группе 20 секунд на текущий сигнал.",
    effect: "extra_time",
    guide: {
      responsibility: "Следите за таймером и предупреждайте команду, когда время заканчивается.",
      useWhen: "Когда осталось меньше 30 секунд, а решение ещё не готово.",
      result: "Таймер ведущего сразу увеличится на 20 секунд.",
      buttonLabel: "ДОБАВИТЬ 20 СЕКУНД",
    },
  },
  {
    id: "archivist",
    name: "Архивариус",
    callSign: "ПАМЯТЬ",
    icon: "archive",
    mission: "Сравнивайте новую улику с уже восстановленными фрагментами дела.",
    abilityName: "Поднять архив",
    abilityDescription: "Один раз за дело открывает подсказку Хостика без штрафа.",
    effect: "free_hint",
    guide: {
      responsibility: "Напоминайте команде о прошлых сигналах и повторяющихся деталях сюжета.",
      useWhen: "Когда команда застряла и не понимает, как связать найденные факты.",
      result: "На экране ведущего бесплатно откроется подсказка Хостика.",
      buttonLabel: "ОТКРЫТЬ ПОДСКАЗКУ",
    },
  },
  {
    id: "cryptographer",
    name: "Криптограф",
    callSign: "КЛЮЧ",
    icon: "shield",
    mission: "Проверяйте, выдерживает ли версия все найденные факты.",
    abilityName: "Сброс помех",
    abilityDescription: "Один раз за дело снижает угрозу на 6%.",
    effect: "reduce_threat",
    guide: {
      responsibility: "Проверяйте, объясняет ли выбранная версия сразу все найденные детали.",
      useWhen: "Когда угроза стала высокой или команда уже допустила ошибку.",
      result: "Уровень угрозы на экране ведущего снизится на 6%.",
      buttonLabel: "СНИЗИТЬ УГРОЗУ НА 6%",
    },
  },
  {
    id: "coordinator",
    name: "Координатор",
    callSign: "ТАКТ",
    icon: "timer",
    mission: "Собирайте команду вокруг одной версии до истечения времени.",
    abilityName: "Резерв",
    abilityDescription: "Один раз за дело добавляет группе 20 секунд на обсуждение.",
    effect: "extra_time",
    guide: {
      responsibility: "Следите, чтобы каждый высказал версию и команда вовремя перешла к голосованию.",
      useWhen: "Когда осталось меньше 30 секунд, а голоса команды расходятся.",
      result: "Таймер ведущего сразу увеличится на 20 секунд.",
      buttonLabel: "ДАТЬ КОМАНДЕ 20 СЕКУНД",
    },
  },
  {
    id: "profiler",
    name: "Профайлер",
    callSign: "КОНТУР",
    icon: "profile",
    mission: "Отделяйте намеренный обман противника от случайного шума.",
    abilityName: "Холодное чтение",
    abilityDescription: "Один раз за дело снижает угрозу на 6%, отсекая ловушку.",
    effect: "reduce_threat",
    guide: {
      responsibility: "Отмечайте детали, которые противник мог специально оставить для отвлечения.",
      useWhen: "Когда команда пошла по ложному следу или уровень угрозы вырос.",
      result: "Уровень угрозы на экране ведущего снизится на 6%.",
      buttonLabel: "ОТСЕЧЬ ЛОВУШКУ · −6%",
    },
  },
];

export type SharedGameState = {
  roundIndex: number;
  signalOpen: boolean;
  resolved: boolean;
  lastCorrect: boolean | null;
  threat: number;
  score: number;
  timeLeft: number;
  /** Shared operative deadline in epoch ms. Null while the team is reading or in story mode. */
  timerDeadline: number | null;
  /** Rounds where the analyst already opened a private hint. */
  analystRounds: number[];
  analysisByRound: Record<number, number[]>;
  hintsUsed: number[];
  eliminatedDistricts: DistrictId[];
  deductionsSolved: number[];
  casePoints: number;
  finalChoice: DistrictId | null;
  networkFailed: boolean;
  processedAbilityEventIds: number[];
};

export type PublicParticipant = {
  id: string;
  name: string;
  seat: number;
  isHost: boolean;
  ready: boolean;
  abilityUsed: boolean;
  online: boolean;
  voteRound: number | null;
  voteDistrict: DistrictId | null;
};

export type RoomEvent = {
  id: number;
  kind: "ability" | "system";
  participantId: string;
  participantName: string;
  roleId: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type RoomPayload = {
  code: string;
  caseId: CaseId;
  mode: GameMode;
  status: RoomStatus;
  revision: number;
  state: SharedGameState | null;
  players: PublicParticipant[];
  me: PublicParticipant & { roleId: string };
  events: RoomEvent[];
  updatedAt: string;
};

export type RoomSession = {
  code: string;
  token: string;
  participantId: string;
  isHost: boolean;
};

export const ROOM_SESSION_KEY = "sled_room_session_v2";

export function roleById(roleId: string) {
  return playerRoles.find((role) => role.id === roleId) ?? playerRoles[0];
}

export function createInitialSharedState(time: number): SharedGameState {
  return {
    roundIndex: 0,
    signalOpen: false,
    resolved: false,
    lastCorrect: null,
    threat: 28,
    score: 0,
    timeLeft: time,
    timerDeadline: null,
    analystRounds: [],
    analysisByRound: {},
    hintsUsed: [],
    eliminatedDistricts: [],
    deductionsSolved: [],
    casePoints: 0,
    finalChoice: null,
    networkFailed: false,
    processedAbilityEventIds: [],
  };
}
