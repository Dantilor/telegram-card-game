/**
 * Централизованный маппинг изображений.
 * Готов к добавлению WebP: webpSrc для каждого ключа.
 */

import cardGameHero from './card_game_hero.png'
import mafiaGame from './mafia_game.png'
import activityGame from './activity_game.png'
import sabotageGame from './sabotage_game.png'
import aliasGame from './alias_game.png'
import quizGame from './quiz_game.png'
import truthDareGame from './truth_dare_game.png'
import whoIsWhoGame from '../games/who-is-who/assets/who-is-who-card.png'
import phraseTranslatorGame from './phrase_translator_game.png'
import freebieTrashGame from './freebie_trash_game.png'
import russiaTravelGame from './russia_travel_game.png'
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

/** URL картинок первого экрана (сетка игр + режимы карточной игры) для preload */
export const PRELOAD_CRITICAL_URLS: string[] = [
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
  IMAGES.fireplaceScene.png,
  IMAGES.datesMode.png,
  IMAGES.partyMode.png,
  IMAGES.adultMode.png,
  IMAGES.psychologyMode.png,
  IMAGES.lifeChoiceMode.png,
]
