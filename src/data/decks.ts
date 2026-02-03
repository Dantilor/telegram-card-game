import type { DeckFull } from './types'
import { getCustomDeck } from './customDecks'
import { aboutUsQuestions } from './questions/aboutUs'
import { feelingsQuestions } from './questions/feelings'
import { pastQuestions } from './questions/past'
import { futureQuestions } from './questions/future'
import { conflictsHonestyQuestions } from './questions/conflictsHonesty'
import { desiresDreamsQuestions } from './questions/desiresDreams'
import { iUnderstandYouQuestions } from './questions/iUnderstandYou'
import { mostLikelyQuestions } from './questions/mostLikely'
import { factsAboutUsQuestions } from './questions/factsAboutUs'
import { lifeStoriesQuestions } from './questions/lifeStories'
import { awkwardSituationsQuestions } from './questions/awkwardSituations'
import { funnyAccusationsQuestions } from './questions/funnyAccusations'
import { votingQuestions } from './questions/voting'
import { noFilterQuestions } from './questions/noFilter'
import { absurdHumorQuestions } from './questions/absurdHumor'
import { finalRoundQuestions } from './questions/finalRound'
import { fantasiesQuestions } from './questions/fantasies'
import { tabooQuestions } from './questions/taboo'
import { experienceQuestions } from './questions/experience'
import { boundariesQuestions } from './questions/boundaries'
import { desiresQuestions } from './questions/desires'
import { roleplayQuestions } from './questions/roleplay'
import { provocationsQuestions } from './questions/provocations'
import { honestlyOrSkipQuestions } from './questions/honestlyOrSkip'
import { intimateWithoutWordsQuestions } from './questions/intimateWithoutWords'
import { whatIfScenariosQuestions } from './questions/whatIfScenarios'
import { fearsQuestions } from './questions/fears'
import { confidenceQuestions } from './questions/confidence'
import { valuesQuestions } from './questions/values'
import { choicesQuestions } from './questions/choices'
import { personalBoundariesQuestions } from './questions/personalBoundaries'
import { innerChildQuestions } from './questions/innerChild'
import { fatigueQuestions } from './questions/fatigue'
import { wishesQuestions } from './questions/wishes'
import { selfHonestyQuestions } from './questions/selfHonesty'
import { growthQuestions } from './questions/growth'
import { careerQuestions } from './questions/career'
import { moneyQuestions } from './questions/money'
import { relationshipsQuestions } from './questions/relationships'
import { freedomQuestions } from './questions/freedom'
import { responsibilityQuestions } from './questions/responsibility'
import { riskQuestions } from './questions/risk'
import { comfortQuestions } from './questions/comfort'
import { happinessQuestions } from './questions/happiness'
import { meaningQuestions } from './questions/meaning'
import { decisiveChoiceQuestions } from './questions/decisiveChoice'

export type Deck = {
  id: string
  title: string
  description: string
  isPremium: boolean
  questionsCount: number
}

export const CUSTOM_DECK_PREFIX = 'custom-'

const questionsByDeckId: Record<string, string[]> = {
  aboutUs: aboutUsQuestions,
  feelings: feelingsQuestions,
  past: pastQuestions,
  future: futureQuestions,
  conflictsHonesty: conflictsHonestyQuestions,
  desiresDreams: desiresDreamsQuestions,
  iUnderstandYou: iUnderstandYouQuestions,
  mostLikely: mostLikelyQuestions,
  factsAboutUs: factsAboutUsQuestions,
  lifeStories: lifeStoriesQuestions,
  awkwardSituations: awkwardSituationsQuestions,
  funnyAccusations: funnyAccusationsQuestions,
  voting: votingQuestions,
  noFilter: noFilterQuestions,
  absurdHumor: absurdHumorQuestions,
  finalRound: finalRoundQuestions,
  fantasies: fantasiesQuestions,
  taboo: tabooQuestions,
  experience: experienceQuestions,
  boundaries: boundariesQuestions,
  desires: desiresQuestions,
  roleplay: roleplayQuestions,
  provocations: provocationsQuestions,
  honestlyOrSkip: honestlyOrSkipQuestions,
  intimateWithoutWords: intimateWithoutWordsQuestions,
  whatIfScenarios: whatIfScenariosQuestions,
  fears: fearsQuestions,
  confidence: confidenceQuestions,
  values: valuesQuestions,
  choices: choicesQuestions,
  personalBoundaries: personalBoundariesQuestions,
  innerChild: innerChildQuestions,
  fatigue: fatigueQuestions,
  wishes: wishesQuestions,
  selfHonesty: selfHonestyQuestions,
  growth: growthQuestions,
  career: careerQuestions,
  money: moneyQuestions,
  relationships: relationshipsQuestions,
  freedom: freedomQuestions,
  responsibility: responsibilityQuestions,
  risk: riskQuestions,
  comfort: comfortQuestions,
  happiness: happinessQuestions,
  meaning: meaningQuestions,
  decisiveChoice: decisiveChoiceQuestions,
}

export const decks: Deck[] = [
  {
    id: 'aboutUs',
    title: 'Реальность нашей пары',
    description: 'Диагностика «мы»: честно и по делу.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'feelings',
    title: 'Эмоциональный вайб',
    description: 'Тепло, тревожно, тихо или искрит?',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'past',
    title: 'Архив воспоминаний',
    description: 'Память, опыт и маленькие откровения.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'future',
    title: 'Следующая глава',
    description: 'Будущее: планы, желания и реальность.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'conflictsHonesty',
    title: 'Разговоры, которые мы избегали',
    description: 'Снимаем напряжение словами, а не молчанием.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'desiresDreams',
    title: 'Топливо нашей жизни',
    description: 'Желания, мечты и то, что нас разжигает.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'iUnderstandYou',
    title: 'Переводчик твоих чувств',
    description: 'Я рядом — даже когда сложно.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'mostLikely',
    title: 'Самый вероятный',
    description: 'Угадай, кто из компании подходит под описание.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'factsAboutUs',
    title: 'Факты про нас',
    description: 'Честные факты о компании.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'lifeStories',
    title: 'Истории из жизни',
    description: 'Расскажи историю из своей жизни.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'awkwardSituations',
    title: 'Неловкие ситуации',
    description: 'Расскажи о неловком моменте.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'funnyAccusations',
    title: 'Шуточные обвинения',
    description: 'Вина без вины — только шутки.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'voting',
    title: 'Голосование',
    description: 'Голосуйте за того, кто подходит под описание.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'noFilter',
    title: 'Без фильтра',
    description: 'Честные вопросы без прикрас.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'absurdHumor',
    title: 'Абсурд и юмор',
    description: 'Смешные и абсурдные вопросы.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'finalRound',
    title: 'Финальный раунд (самые жёсткие)',
    description: 'Честные и непростые вопросы.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'fantasies',
    title: 'Фантазии',
    description: 'Интимные фантазии и желания.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'taboo',
    title: 'Табу',
    description: 'Границы, запреты и личные пределы.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'experience',
    title: 'Опыт',
    description: 'Уроки и открытия в близости.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'boundaries',
    title: 'Границы',
    description: 'Согласие, отказ и уважение личных пределов.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'desires',
    title: 'Желания',
    description: 'Мечты, просьбы и то, чего хочется.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'roleplay',
    title: 'Ролевые вопросы',
    description: 'Игры, сценарии и фантазии в ролях.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'provocations',
    title: 'Провокации',
    description: 'Дерзкие вопросы и смелые намёки.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'honestlyOrSkip',
    title: 'Честно или пропусти',
    description: 'Прямые вопросы — отвечай честно или пропускай.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'intimateWithoutWords',
    title: 'Интим без слов',
    description: 'Жесты, взгляды и сигналы вместо слов.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'whatIfScenarios',
    title: 'Сценарии «а если»',
    description: 'Воображаемые ситуации и гипотетические выборы.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'fears',
    title: 'Про страхи',
    description: 'Исследование страхов и внутренних блоков.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'confidence',
    title: 'Про уверенность',
    description: 'Сильные стороны, опора и внутренняя устойчивость.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'values',
    title: 'Про ценности',
    description: 'То, что важно, нерушимо и определяет тебя.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'choices',
    title: 'Про выбор',
    description: 'Решения, сомнения и внутренние конфликты.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'personalBoundaries',
    title: 'Про границы',
    description: 'Личные пределы, уважение и защита себя.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'innerChild',
    title: 'Про внутреннего ребёнка',
    description: 'Детские раны, радости и забота о себе.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'fatigue',
    title: 'Про усталость',
    description: 'Истощение, темп жизни и настоящий отдых.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'wishes',
    title: 'Про желания',
    description: 'То, чего хочешь на самом деле.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'selfHonesty',
    title: 'Про честность с собой',
    description: 'Правда, самообман и принятие.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'growth',
    title: 'Про рост',
    description: 'Изменения, прорывы и следующие шаги.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'career',
    title: 'Карьера',
    description: 'Работа, смысл и профессиональный путь.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'money',
    title: 'Деньги',
    description: 'Отношение к финансам, ценностям и свободе.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'relationships',
    title: 'Отношения',
    description: 'Близость, выбор и здоровые границы.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'freedom',
    title: 'Свобода',
    description: 'Автономия, выбор и жизнь по своим правилам.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'responsibility',
    title: 'Ответственность',
    description: 'Выбор, последствия и зрелость.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'risk',
    title: 'Риск',
    description: 'Неопределённость, смелость и выход из зоны комфорта.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'comfort',
    title: 'Комфорт',
    description: 'Уют, привычки и баланс.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'happiness',
    title: 'Счастье',
    description: 'Радость, благодарность и жизнь в моменте.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'meaning',
    title: 'Смысл',
    description: 'Глубина, цель и ценность жизни.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'decisiveChoice',
    title: 'Решающий выбор',
    description: 'Главные решения, смелость и точка невозврата.',
    isPremium: false,
    questionsCount: 50,
  },
]

export function getDeckFull(deckId: string): DeckFull | null {
  if (deckId.startsWith(CUSTOM_DECK_PREFIX)) {
    const custom = getCustomDeck(deckId)
    if (!custom || !custom.questions.length) return null
    return {
      id: custom.id,
      title: custom.title,
      description: custom.description ?? '',
      isPremium: false,
      questionsCount: custom.questions.length,
      questions: custom.questions,
    }
  }
  const deck = decks.find((d) => d.id === deckId)
  if (!deck) return null
  const questions = questionsByDeckId[deckId]
  if (!questions || questions.length !== deck.questionsCount) return null
  return { ...deck, questions }
}
