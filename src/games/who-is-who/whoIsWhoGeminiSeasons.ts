import type { Situation } from "./whoIsWhoTypes";
import geminiBatch25 from "./data/gemini-seasons-2-5.json";
import geminiBatch610 from "./data/gemini-seasons-6-10.json";
import geminiBatch1115 from "./data/gemini-seasons-11-15.json";
import geminiBatch1620 from "./data/gemini-seasons-16-20.json";
import geminiBatch2125 from "./data/gemini-seasons-21-25.json";
import geminiBatch2630 from "./data/gemini-seasons-26-30.json";

export type GeminiSeasonMeta = {
  number: number;
  emoji: string;
  title: string;
  subtitle: string;
};

type GeminiSeasonJson = GeminiSeasonMeta & {
  situations: Array<{
    id: string;
    title: string;
    situation: string;
    roles: string[];
  }>;
};

function mapSituations(season: GeminiSeasonJson): Situation[] {
  return season.situations.map((card, index) => ({
    id: `pack-${season.number}-s${String(index + 1).padStart(2, "0")}`,
    title: card.title,
    situation: card.situation,
    roles: [...card.roles],
  }));
}

const seasons = [
  ...(geminiBatch25.seasons as GeminiSeasonJson[]),
  ...(geminiBatch610.seasons as GeminiSeasonJson[]),
  ...(geminiBatch1115.seasons as GeminiSeasonJson[]),
  ...(geminiBatch1620.seasons as GeminiSeasonJson[]),
  ...(geminiBatch2125.seasons as GeminiSeasonJson[]),
  ...(geminiBatch2630.seasons as GeminiSeasonJson[]),
];

/** Ситуации из JSON Gemini (по мере добавления файлов в data/). */
export const GEMINI_SEASON_SITUATIONS: Partial<Record<number, Situation[]>> = Object.fromEntries(
  seasons.map((s) => [s.number, mapSituations(s)])
);

/** Метаданные сезонов из Gemini для подмены в каталоге. */
export const GEMINI_SEASON_META: Partial<Record<number, GeminiSeasonMeta>> = Object.fromEntries(
  seasons.map((s) => [
    s.number,
    { number: s.number, emoji: s.emoji, title: s.title, subtitle: s.subtitle },
  ])
);
