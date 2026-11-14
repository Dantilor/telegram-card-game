/**
 * Централизованный маппинг изображений.
 * Обложки каталога — сжатые копии из `optimized/` (scripts/optimize-catalog-images.mjs);
 * исходники лежат рядом и внутри игр не заменяются.
 */

import cardGameHero from './optimized/catalog-card-game.webp'
import mafiaGame from './optimized/catalog-mafia.webp'
import activityGame from './optimized/catalog-activity.webp'
import sabotageGame from './optimized/catalog-sabotage.webp'
import aliasGame from './optimized/catalog-alias.webp'
import quizGame from './optimized/catalog-quiz.webp'
import truthDareGame from './optimized/catalog-truth-dare.webp'
import whoIsWhoGame from './optimized/catalog-who-is-who.webp'
import phraseTranslatorGame from './optimized/catalog-phrase-translator.webp'
import freebieTrashGame from './optimized/catalog-freebie-trash.webp'
import russiaTravelGame from './optimized/catalog-russia-travel.webp'
import sledCover from './optimized/catalog-sled.webp'
import mafiaShadowsHero from './optimized/catalog-mafia-shadows.webp'
import doublesKeyart from './optimized/catalog-doubles.webp'
import infectedCover from './optimized/catalog-infected.webp'
import homePickMafiaShadows from './optimized/home-pick-mafia-shadows.webp'
import homePickDoubles from './optimized/home-pick-doubles.webp'
import homePickInfected from './optimized/home-pick-infected.webp'
import fireplaceScene from './fireplace_scene.png'
import adultMode from './adult_mode.png'
import partyMode from './party_mode.png'
import datesMode from './dates_mode.png'
import psychologyMode from './psychology_mode.png'
import lifeChoiceMode from './life_choice_mode.png'
import mafiaDoctor from './mafia_doctor.png'
import mafiaRole from './mafia_role.png'
import mafiaSheriff from './mafia_sheriff.png'
import mafiaCivilian1 from './mafia_civilian1.png'
import mafiaCivilian2 from './mafia_civilian2.png'
import mafiaHost from './mafia_host.png'

export type ImageAsset = {
  png: string
  webp?: string
}

export const IMAGES: Record<string, ImageAsset> = {
  cardGameHero: { png: cardGameHero },
  mafia: { png: mafiaGame },
  activity: { png: activityGame },
  sabotage: { png: sabotageGame },
  alias: { png: aliasGame },
  quiz: { png: quizGame },
  truthDare: { png: truthDareGame },
  whoIsWho: { png: whoIsWhoGame },
  phraseTranslator: { png: phraseTranslatorGame },
  freebieTrash: { png: freebieTrashGame },
  russiaTravel: { png: russiaTravelGame },
  sled: { png: sledCover },
  mafiaShadows: { png: mafiaShadowsHero },
  doubles: { png: doublesKeyart },
  infected: { png: infectedCover },
  fireplaceScene: { png: fireplaceScene },
  adultMode: { png: adultMode },
  partyMode: { png: partyMode },
  datesMode: { png: datesMode },
  psychologyMode: { png: psychologyMode },
  lifeChoiceMode: { png: lifeChoiceMode },
  mafiaDoctor: { png: mafiaDoctor },
  mafiaRole: { png: mafiaRole },
  mafiaSheriff: { png: mafiaSheriff },
  mafiaCivilian1: { png: mafiaCivilian1 },
  mafiaCivilian2: { png: mafiaCivilian2 },
  mafiaHost: { png: mafiaHost },
}

/** URL картинок Мафии для preload при входе в игру */
export const PRELOAD_MAFIA_URLS: string[] = [
  IMAGES.mafiaDoctor.png,
  IMAGES.mafiaRole.png,
  IMAGES.mafiaSheriff.png,
  IMAGES.mafiaCivilian1.png,
  IMAGES.mafiaCivilian2.png,
  IMAGES.mafiaHost.png,
]

/** Миниатюры блока «Попробуйте сегодня» на Home (десятки КБ вместо мегабайтных обложек). */
export const HOME_PICK_THUMBS = {
  mafiaShadows: homePickMafiaShadows,
  doubles: homePickDoubles,
  infected: homePickInfected,
} as const

/**
 * Только то, что видно на Home в блоке «Попробуйте сегодня».
 * Не включать весь каталог игр — иначе холодный старт на мобильном душится десятками картинок.
 */
export const PRELOAD_HOME_URLS: string[] = Object.values(HOME_PICK_THUMBS)

/** Каталог игр + режимы карточной игры — preload только после перехода на /games. */
export const PRELOAD_GAMES_CATALOG_URLS: string[] = [
  IMAGES.cardGameHero.png,
  IMAGES.mafia.png,
  IMAGES.activity.png,
  IMAGES.sabotage.png,
  IMAGES.alias.png,
  IMAGES.quiz.png,
  IMAGES.truthDare.png,
  IMAGES.whoIsWho.png,
  IMAGES.phraseTranslator.png,
  IMAGES.freebieTrash.png,
  IMAGES.russiaTravel.png,
  IMAGES.sled.png,
  IMAGES.mafiaShadows.png,
  IMAGES.doubles.png,
  IMAGES.infected.png,
  IMAGES.fireplaceScene.png,
  IMAGES.datesMode.png,
  IMAGES.partyMode.png,
  IMAGES.adultMode.png,
  IMAGES.psychologyMode.png,
  IMAGES.lifeChoiceMode.png,
]

/** @deprecated Используйте PRELOAD_HOME_URLS / PRELOAD_GAMES_CATALOG_URLS */
export const PRELOAD_CRITICAL_URLS: string[] = PRELOAD_HOME_URLS
