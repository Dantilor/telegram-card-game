import { SITUATIONS_PER_PACK } from "./whoIsWhoSlotCatalog";
import type { PackProgress, Situation, SituationPack } from "./whoIsWhoTypes";
import { shuffle } from "./whoIsWhoUtils";

const PROGRESS_STORAGE_KEY = "who-is-who:pack-progress";

export type PackProgressMap = Record<string, PackProgress>;

function freshRemainingIndices(): number[] {
  return shuffle(
    Array.from({ length: SITUATIONS_PER_PACK }, (_, i) => i)
  );
}

export function createFreshPackProgress(packId: string): PackProgress {
  return {
    packId,
    remainingIndices: freshRemainingIndices(),
    completed: false,
    playedTotal: 0,
  };
}

export function loadPackProgressMap(): PackProgressMap {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return {};
    const map: PackProgressMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object") continue;
      const v = value as PackProgress;
      if (
        typeof v.packId === "string" &&
        Array.isArray(v.remainingIndices) &&
        typeof v.completed === "boolean"
      ) {
        map[key] = {
          packId: v.packId,
          remainingIndices: v.remainingIndices.filter((n) => typeof n === "number"),
          completed: v.completed,
          playedTotal: typeof v.playedTotal === "number" ? v.playedTotal : 0,
        };
      }
    }
    return map;
  } catch {
    return {};
  }
}

export function savePackProgressMap(map: PackProgressMap): void {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function getPackProgress(
  map: PackProgressMap,
  packId: string
): PackProgress {
  return map[packId] ?? createFreshPackProgress(packId);
}

/** Сколько ситуаций уже сыграно в текущем (или завершённом) прохождении. */
export function playedInPack(progress: PackProgress): number {
  return SITUATIONS_PER_PACK - progress.remainingIndices.length;
}

export function progressPercent(progress: PackProgress): number {
  return Math.round((playedInPack(progress) / SITUATIONS_PER_PACK) * 100);
}

/** Берёт следующую ситуацию из сезона и обновляет прогресс. */
export function drawFromPack(
  pack: SituationPack,
  progress: PackProgress
): { situation: Situation; progress: PackProgress } {
  let remaining = [...progress.remainingIndices];
  if (remaining.length === 0) {
    remaining = freshRemainingIndices();
  }

  const [situationIndex, ...rest] = remaining;
  const playedTotal = progress.playedTotal + 1;
  const deckEmpty = rest.length === 0;

  const next: PackProgress = {
    packId: pack.id,
    remainingIndices: rest,
    completed: deckEmpty,
    playedTotal,
  };

  return {
    situation: pack.situations[situationIndex],
    progress: next,
  };
}

/** Сброс сезона для повторного прохождения. */
export function resetPackProgress(packId: string): PackProgress {
  return createFreshPackProgress(packId);
}

/** Номер следующего непройденного сезона (1-based) или null. */
export function nextUncompletedPackNumber(
  map: PackProgressMap,
  packs: SituationPack[]
): number | null {
  const next = packs.find((p) => !getPackProgress(map, p.id).completed);
  return next?.number ?? null;
}
