import { PACK_COVERS } from "./whoIsWhoPackCovers";
import { SITUATIONS as BASE_SITUATIONS } from "./whoIsWhoData";
import { PACK_CATALOG, PACK_COUNT, SITUATIONS_PER_PACK } from "./whoIsWhoSlotCatalog";
import { GEMINI_SEASON_META, GEMINI_SEASON_SITUATIONS } from "./whoIsWhoGeminiSeasons";
import { SEASON_SITUATIONS } from "./whoIsWhoSeasonSituations";
import type { Situation, SituationPack } from "./whoIsWhoTypes";

function getCustomSeasonSituations(seasonNumber: number): Situation[] | undefined {
  return SEASON_SITUATIONS[seasonNumber] ?? GEMINI_SEASON_SITUATIONS[seasonNumber];
}

/**
 * Собирает 20 ситуаций для сезона.
 * Если есть готовый контент — используем его, иначе базовые карты по кругу.
 */
function buildPackSituations(packIndex: number): Situation[] {
  const seasonNumber = packIndex + 1;
  const custom = getCustomSeasonSituations(seasonNumber);
  if (custom?.length === SITUATIONS_PER_PACK) {
    return custom.map((s) => ({ ...s, roles: [...s.roles] }));
  }

  const situations: Situation[] = [];

  for (let i = 0; i < SITUATIONS_PER_PACK; i++) {
    const base = BASE_SITUATIONS[(packIndex * 11 + i * 7) % BASE_SITUATIONS.length];
    const packNum = packIndex + 1;
    situations.push({
      id: `pack-${packNum}-s${i + 1}`,
      title: base.title,
      situation: base.situation,
      roles: [...base.roles],
    });
  }

  return situations;
}

/** Все 30 сезонов с полным набором ситуаций. */
export const SITUATION_PACKS: SituationPack[] = PACK_CATALOG.map((meta, index) => {
  const number = index + 1;
  const gemini = GEMINI_SEASON_META[number];
  return {
    id: `pack-${number}`,
    number,
    title: gemini?.title ?? meta.title,
    subtitle: gemini?.subtitle ?? meta.subtitle,
    emoji: gemini?.emoji ?? meta.emoji,
    coverImage: PACK_COVERS[number],
    situations: buildPackSituations(index),
  };
});

export function getPackById(packId: string): SituationPack | undefined {
  return SITUATION_PACKS.find((p) => p.id === packId);
}

export function getPackByNumber(num: number): SituationPack | undefined {
  return SITUATION_PACKS.find((p) => p.number === num);
}

export { PACK_COUNT, SITUATIONS_PER_PACK };
