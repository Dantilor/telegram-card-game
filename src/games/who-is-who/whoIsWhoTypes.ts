/**
 * Типы игры «Кто тут кто?».
 * Модуль самодостаточный: ни от чего во внешнем проекте не зависит.
 */

/** Игрок из текущей компании. */
export interface Player {
  id: string;
  name: string;
}

/** Ситуация (карта из колоды) с набором ролей. */
export interface Situation {
  id: string;
  /** Короткое название карточки, например «Поездка на дачу». */
  title: string;
  /** Развернутое описание ситуации. */
  situation: string;
  /** Список ролей, на каждую из которых нужно назначить игрока. */
  roles: string[];
}

/** Сезон из 20 ситуаций — отдельная глава игры. */
export interface SituationPack {
  id: string;
  /** Порядковый номер 1–30 для отображения. */
  number: number;
  title: string;
  subtitle: string;
  emoji: string;
  /** Обложка сезона для карточки и превью на экране настройки. */
  coverImage?: string;
  situations: Situation[];
}

/** Прогресс прохождения сезона (сохраняется в localStorage). */
export interface PackProgress {
  packId: string;
  /** Индексы ситуаций в `pack.situations`, которые ещё не сыграны в текущем прохождении. */
  remainingIndices: number[];
  completed: boolean;
  /** Сколько ситуаций сыграно за всё время (для статистики). */
  playedTotal: number;
}

/** Экраны игры. */
export type Screen = "start" | "round" | "result" | "seasonComplete";

/**
 * Назначения ролей: ключ — индекс роли в массиве `situation.roles`
 * (в виде строки), значение — id игрока.
 */
export type Assignments = Record<string, string>;
