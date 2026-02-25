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
import { sparkFirstImpressionQuestions } from './questions/sparkFirstImpression'
import { lightFlirtQuestions } from './questions/lightFlirt'
import { genuineInterestQuestions } from './questions/genuineInterest'
import { emotionsClosenessQuestions } from './questions/emotionsCloseness'
import { personalLightQuestions } from './questions/personalLight'
import { whatIfIntrigueQuestions } from './questions/whatIfIntrigue'
import { sincereFinalQuestions } from './questions/sincereFinal'

export type Deck = {
  id: string
  title: string
  description: string
  isPremium: boolean
  questionsCount: number
  /** Текст над каждым вопросом (например, для колоды «Байки из прошлого») */
  cardPrompt?: string
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
  sparkFirstImpression: sparkFirstImpressionQuestions,
  lightFlirt: lightFlirtQuestions,
  genuineInterest: genuineInterestQuestions,
  emotionsCloseness: emotionsClosenessQuestions,
  personalLight: personalLightQuestions,
  whatIfIntrigue: whatIfIntrigueQuestions,
  sincereFinal: sincereFinalQuestions,
}

export const decks: Deck[] = [
  {
    id: 'aboutUs',
    title: 'Реальность нашей пары',
    description: 'Диагностика отношений честно и по делу. Выясняем, как мы устроены, в чем наша сила и какие мы на самом деле.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'feelings',
    title: 'Эмоциональный вайб',
    description: 'Тепло, тревожно, тихо или искрит? Откровенно о настроении, скрытых чувствах и атмосфере между нами здесь и сейчас.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'past',
    title: 'Архив воспоминаний',
    description: 'Память, опыт и откровения. Совместное путешествие от детских страхов до того момента, как мы стали «нами».',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'future',
    title: 'Следующая глава',
    description: 'Будущее, планы и реальность. Мечтаем, строим фундамент на годы вперед и честно обсуждаем, куда мы идем.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'conflictsHonesty',
    title: 'О чем мы молчим',
    description: 'Снимаем напряжение словами, а не молчанием. Разбор полетов, сложных тем и честность, которая делает нас ближе.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'desiresDreams',
    title: 'Топливо жизни',
    description: 'Желания, мечты и то, что нас разжигает. Разговор об амбициях, драйве и нашем совместном пути к звездам.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'iUnderstandYou',
    title: 'Переводчик чувств',
    description: 'Я рядом — даже когда сложно. Настраиваем личный язык любви, чтобы никто из нас не чувствовал себя одиноким в паре.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'sparkFirstImpression',
    title: 'Первая искра',
    description: 'Знакомство, химия и первое впечатление. Вопросы, чтобы растопить лед, снять неловкость и понять, кто сидит напротив.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'lightFlirt',
    title: 'Легкий флирт',
    description: 'Тонкие намеки, комплименты и игра взглядов. Повышаем градус, убираем дистанцию и исследуем химию между нами.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'genuineInterest',
    title: 'Настоящий интерес',
    description: 'Внимание, глубина и живой диалог. Переходим от светских бесед к вопросам, которые помогают по-настоящему узнать человека.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'emotionsCloseness',
    title: 'Эмоции и близость',
    description: 'Доверие, открытость и тихая глубина. Разговор о том, как мы чувствуем друг друга и создаем наше безопасное пространство.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'personalLight',
    title: 'Просто о личном',
    description: 'Радости, комфорт и легкость. Идеальный способ узнать человека через его быт, привычки и маленькие слабости без нарушения границ.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'whatIfIntrigue',
    title: 'Сценарий «А если…»',
    description: 'Смелые гипотетические ситуации. Включаем фантазию, моделируем необычные сюжеты и проверяем готовность к авантюрам.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'sincereFinal',
    title: 'Искренний финал',
    description: 'Красивое и честное завершение вечера: делимся впечатлениями, оставляем теплое послевкусие и перекидываем мостик к следующей встрече.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'mostLikely',
    title: 'Самый вероятный',
    description: 'Кто из нас скорее всего...? Раздаем ярлыки, указываем пальцами и выбираем главных кандидатов на безумные поступки.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'factsAboutUs',
    title: 'Анатомия дружбы',
    description: 'Честные факты о компании. Голосуем и вспоминаем неловкие истории, о которых многие предпочли бы забыть.',
    isPremium: false,
    questionsCount: 50,
  },
  {
    id: 'lifeStories',
    title: 'Байки из прошлого',
    description: 'Время мощных историй! Делимся смешными и захватывающими случаями, о которых остальные могли даже не догадываться.',
    isPremium: true,
    questionsCount: 50,
    cardPrompt: 'Вспомни и расскажи историю из жизни, когда...',
  },
  {
    id: 'awkwardSituations',
    title: 'Испанский стыд',
    description: 'Снимаем маски идеальности. Вспоминаем нелепые и постыдные провалы, за которые до сих пор горят щеки.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'funnyAccusations',
    title: 'Шуточный трибунал',
    description: 'Вызываем на ковер! Предъявляем друзьям абсурдные претензии и учимся отбиваться от веселых нападок.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'voting',
    title: 'Открытое голосование',
    description: 'Единогласный выбор или жаркие споры? Голосуем всей компанией и выбираем героя для неочевидных жизненных ситуаций.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'noFilter',
    title: 'Без фильтров',
    description: 'Никаких социально ожидаемых ответов. Максимально прямые, неудобные и провокационные вопросы для самых смелых.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'absurdHumor',
    title: 'Абсурд и юмор',
    description: 'Выключаем логику, включаем фантазию. Дикие гипотетические сценарии, странные выборы и генератор чистого смеха.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'finalRound',
    title: 'Финальная прожарка',
    description: 'Жесткие и бескомпромиссные вопросы вечера. Только хардкор, личные секреты и голая правда.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'fantasies',
    title: 'Тайные фантазии',
    description: 'Откровенно о сокровенном. Обсуждаем самые смелые желания и выясняем, что на самом деле заводит вас больше всего.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'taboo',
    title: 'Строгие табу',
    description: 'Границы, запреты и стоп-слова. Честно проговариваем личные пределы, чтобы сделать близость на 100% безопасной.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'experience',
    title: 'Интимный опыт',
    description: 'Уроки и открытия в близости. Анализируем опыт и обсуждаем, как развивается ваша интимная жизнь.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'boundaries',
    title: 'Личные границы',
    description: 'Согласие, уважение и право на отказ. Учимся слышать «нет», снимать давление и создавать зону комфорта для двоих.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'desires',
    title: 'Горячие желания',
    description: 'Мечты, просьбы и то, чего хочется. Прямой разговор о скрытых потребностях без стеснения и осуждения.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'roleplay',
    title: 'Ролевые вопросы',
    description: 'Игры, сценарии и фантазии в ролях. Выходим за рамки привычного: примеряем новые образы и характеры.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'provocations',
    title: 'Провокации',
    description: 'Дерзкие вопросы и смелые намеки. Игра на грани, флирт и создание мощного сексуального напряжения.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'honestlyOrSkip',
    title: 'Честно или пропусти',
    description: 'Максимально прямые вопросы. Отвечай честно или пропускай ход (а штраф в виде раздевания или желания придумайте сами!).',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'intimateWithoutWords',
    title: 'Интим без слов',
    description: 'Жесты, взгляды и скрытые сигналы. Как хорошо вы понимаете язык тела друг друга.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'whatIfScenarios',
    title: 'Сценарий «А если…»',
    description: 'Включаем воображение на максимум. Дикие гипотетические ситуации, сложный интимный выбор и фантазии о нереальном.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'fears',
    title: 'Скрытые страхи',
    description: 'Исследование тревог и внутренних блоков. Учимся смотреть своим главным опасениям прямо в глаза.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'confidence',
    title: 'Внутренняя опора',
    description: 'Сильные стороны и непоколебимая устойчивость. Ищем фундамент, на котором строится любовь к себе.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'values',
    title: 'Жизненные ценности',
    description: 'То, что нерушимо и определяет личность. Честное исследование вашего морального компаса.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'choices',
    title: 'Цена решений',
    description: 'Сомнения, развилки и внутренние конфликты. О том, как мы выбираем свой путь и справляемся с последствиями.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'personalBoundaries',
    title: 'Моя территория',
    description: 'Уважение и защита собственного «Я». Учимся отстаивать свое пространство и отказывать без чувства вины.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'innerChild',
    title: 'Внутренний ребенок',
    description: 'Детские раны, радости и забота о себе. Разговор с той частью тебя, которая все еще верит в чудеса и нуждается в защите.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'fatigue',
    title: 'Ресурс и выгорание',
    description: 'Истощение, темп жизни и поиск энергии. О том, как важно вовремя разрешить себе нажать на паузу.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'wishes',
    title: 'Внутренний огонь',
    description: 'Твои искренние «хочу», скрытые за навязанным «надо». Исследуем мечты, амбиции и право на удовольствие.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'selfHonesty',
    title: 'Без иллюзий',
    description: 'Правда, самообман и тотальное принятие. Учимся смотреть в зеркало без фильтров и признавать мотивы.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'growth',
    title: 'Точка роста',
    description: 'Изменения, прорывы и следующие шаги. Честно о том, как мы трансформируемся и куда движемся.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'career',
    title: 'Карьера и амбиции',
    description: 'Работа, выгорание и профессиональный путь. Ищем баланс между большими целями и суровой реальностью.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'money',
    title: 'Материальный мир',
    description: 'Финансы, статус и независимость. Честно о том, как деньги управляют нашими страхами и тайными желаниями.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'relationships',
    title: 'Связи и привязанность',
    description: 'Близость, одиночество и токсичные паттерны. Разбираемся, как мы строим связи и почему порой боимся доверять людям.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'freedom',
    title: 'Право на свободу',
    description: 'Автономия и жизнь по своим правилам. Что на самом деле мешает дышать полной грудью и как мы распоряжаемся независимостью.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'responsibility',
    title: 'Взрослая жизнь',
    description: 'Выбор, последствия и зрелость. Честно о том, кто управляет твоей жизнью и как ты справляешься с последствиями своих решений.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'risk',
    title: 'Игра по-крупному',
    description: 'Смелость, азарт и выход из зоны комфорта. Разговор о том, что пугает до дрожи, но делает по-настоящему живым.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'comfort',
    title: 'Зона комфорта',
    description: 'Уют, рутина и личная безопасность. Исследование того, где мы ищем покой и как строим свою внутреннюю крепость.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'happiness',
    title: 'Природа счастья',
    description: 'Радость, благодарность и жизнь в моменте. Откровенно о том, что зажигает внутри свет и дает реальную энергию.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'meaning',
    title: 'След после себя',
    description: 'Глубина, цели и истинная ценность. Пытаемся найти честный ответ на вопрос, зачем мы здесь и что останется после нас.',
    isPremium: true,
    questionsCount: 50,
  },
  {
    id: 'decisiveChoice',
    title: 'Точка невозврата',
    description: 'Судьбоносные решения и смелость. Анализ тех самых переломных моментов, когда один единственный шаг меняет всё.',
    isPremium: true,
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
      isPremium: true,
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
