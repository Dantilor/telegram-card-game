import type { ActivityCategoryId } from '../types'

export type { ActivityCategoryId }

export type ActivityCategory = {
  id: ActivityCategoryId
  title: string
  emoji: string
  paid: boolean
  words: string[]
}

const EMOTIONS_WORDS = [
  'сильное удивление', 'радость без причины', 'раздражение', 'неловкость', 'гордость',
  'облегчение', 'скука', 'восторг', 'паника', 'смех сквозь слёзы', 'задумчивость',
  'разочарование', 'самоуверенность', 'смущение', 'предвкушение',
]

const BEHAVIORS_WORDS = [
  'спешить и опаздывать', 'искать потерянную вещь', 'делать вид что всё под контролем',
  'объяснять что-то очень сложно', 'радоваться маленькой победе', 'стараться не засмеяться',
  'делать вид что понял', 'паниковать внутри но улыбаться', 'прятаться', 'уговаривать',
  'хвастаться', 'сомневаться', 'проверять телефон', 'подслушивать', 'делать сюрприз',
]

const CHARACTERS_WORDS = [
  'очень уверенный человек', 'человек который всё знает', 'тот кто всегда опаздывает',
  'душнила', 'чрезмерно вежливый', 'слишком честный', 'загадочный тип', 'паникёр',
  'вечно уставший', 'оптимист', 'пессимист', 'скептик', 'любитель внимания',
  'стеснительный человек', 'лидер компании',
]

const LIFE_SITUATIONS_WORDS = [
  'первый день на новой работе', 'неожиданная встреча', 'неловкое знакомство',
  'праздник который пошёл не по плану', 'очередь', 'опоздал на встречу', 'сюрприз',
  'непонятное задание', 'совещание', 'важный разговор', 'случайный успех',
  'провал который скрывают', 'подготовка к выходу', 'встреча старых знакомых',
  'неожиданная новость',
]

const AWKWARD_MOMENTS_WORDS = [
  'забыл имя', 'сказал лишнее', 'не понял шутку', 'сделал не тот вывод', 'неловкая пауза',
  'не туда посмотрел', 'не понял намёк', 'попытка выкрутиться', 'случайно перебил',
  'сделал вид что так и было задумано', 'слишком громко сказал', 'попал не в тему',
  'ошибка которую заметили', 'неловкая улыбка', 'когда все смотрят',
]

const COMMUNICATION_WORDS = [
  'объяснять без слов', 'спорить', 'соглашаться без энтузиазма', 'убеждать', 'оправдываться',
  'делать комплимент', 'намекать', 'делать вид что занят', 'отказываться вежливо',
  'делать паузу перед ответом', 'скрывать эмоции', 'поддерживать разговор',
  'делать важный вид', 'удивляться ответу', 'заканчивать разговор',
]

const SCENES_WORDS = [
  'погоня', 'побег', 'финальная битва', 'признание', 'неожиданный поворот', 'тайная встреча',
  'раскрытие тайны', 'опасный план', 'предательство', 'спасение в последний момент',
  'романтическая сцена', 'драматичная пауза', 'ссора', 'объятие', 'счастливый финал',
]

export const ACTIVITY_CATEGORIES: ActivityCategory[] = [
  { id: 'emotions', title: 'Эмоции', emoji: '😶', paid: false, words: EMOTIONS_WORDS },
  { id: 'behaviors', title: 'Поведение', emoji: '🎭', paid: false, words: BEHAVIORS_WORDS },
  { id: 'characters', title: 'Персонажи', emoji: '👤', paid: false, words: CHARACTERS_WORDS },
  { id: 'lifeSituations', title: 'Ситуации', emoji: '🌍', paid: false, words: LIFE_SITUATIONS_WORDS },
  { id: 'awkwardMoments', title: 'Неловкость', emoji: '😅', paid: false, words: AWKWARD_MOMENTS_WORDS },
  { id: 'communication', title: 'Общение', emoji: '💬', paid: false, words: COMMUNICATION_WORDS },
  { id: 'scenes', title: 'Сцены', emoji: '🎬', paid: false, words: SCENES_WORDS },
]

export function getCategoryById(id: ActivityCategoryId): ActivityCategory | undefined {
  return ACTIVITY_CATEGORIES.find((c) => c.id === id)
}

export function pickRandomWord(category: ActivityCategory): string {
  const words = category.words
  return words[Math.floor(Math.random() * words.length)] ?? ''
}
