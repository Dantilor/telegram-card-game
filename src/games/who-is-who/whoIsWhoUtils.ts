import type { Player, Situation } from "./whoIsWhoTypes";

/** Минимальное число игроков, чтобы начать игру. */
export const MIN_PLAYERS = 3;

/** Доступные варианты числа игроков на старте. */
export const PLAYER_COUNT_OPTIONS = [3, 4, 5] as const;

export type PlayerCountOption = (typeof PLAYER_COUNT_OPTIONS)[number];

/** Время на оправдание (сек), упоминается на экране итога. */
export const JUSTIFY_SECONDS = 15;

const PLAYERS_STORAGE_KEY = "who-is-who:players";

/** Генерирует простой уникальный id. */
export function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Перемешивает массив (алгоритм Фишера—Йетса), не мутируя исходный. */
export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Создает «колоду» индексов ситуаций в случайном порядке.
 * Используется, чтобы ситуации не повторялись, пока колода не закончится.
 */
export function buildDeck(situations: Situation[]): number[] {
  return shuffle(situations.map((_, index) => index));
}

/** Загружает игроков из localStorage (безопасно при отсутствии/ошибке). */
export function loadPlayers(): Player[] {
  try {
    const raw = localStorage.getItem(PLAYERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is Player =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as Player).id === "string" &&
        typeof (p as Player).name === "string"
    );
  } catch {
    return [];
  }
}

/** Сохраняет игроков в localStorage. */
export function savePlayers(players: Player[]): void {
  try {
    localStorage.setItem(PLAYERS_STORAGE_KEY, JSON.stringify(players));
  } catch {
    /* localStorage может быть недоступен — тихо игнорируем */
  }
}

/** Начальное число игроков и имена слотов из сохранённого состава. */
export function initPlayerSlotsFromStorage(): {
  count: PlayerCountOption;
  names: string[];
} {
  const saved = loadPlayers();
  const rawCount = saved.length > 0 ? saved.length : MIN_PLAYERS;
  const count = clampPlayerCount(rawCount);
  const names = Array.from({ length: count }, (_, i) => saved[i]?.name ?? "");
  return { count, names };
}

export function clampPlayerCount(count: number): PlayerCountOption {
  const clamped = Math.min(
    PLAYER_COUNT_OPTIONS[PLAYER_COUNT_OPTIONS.length - 1],
    Math.max(MIN_PLAYERS, count)
  );
  return PLAYER_COUNT_OPTIONS.includes(clamped as PlayerCountOption)
    ? (clamped as PlayerCountOption)
    : MIN_PLAYERS;
}

/** Подгоняет массив имён под выбранное число игроков. */
export function resizePlayerNames(names: string[], count: number): string[] {
  return Array.from({ length: count }, (_, i) => names[i] ?? "");
}

/** Берёт первые N ролей ситуации — по числу игроков в раунде. */
export function rolesForPlayerCount(roles: string[], playerCount: number): string[] {
  return roles.slice(0, Math.min(playerCount, roles.length));
}
