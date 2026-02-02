import type { Question } from '../types'

export const QUIZ_QUESTIONS: Question[] = [
  { id: 'q1', text: 'Сколько планет в Солнечной системе?', answers: ['7', '8', '9', '10'], correctIndex: 1, difficulty: 1, tags: ['science'] },
  { id: 'q2', text: 'Какой газ составляет большую часть атмосферы Земли?', answers: ['Кислород', 'Азот', 'Углекислый газ', 'Водород'], correctIndex: 1, difficulty: 1, tags: ['science'] },
  { id: 'q3', text: 'В каком году началась Вторая мировая война?', answers: ['1937', '1939', '1941', '1943'], correctIndex: 1, difficulty: 2, tags: ['history'] },
  { id: 'q4', text: 'Какой фильм получил «Оскар» за лучший фильм в 2020 году?', answers: ['1917', 'Паразиты', 'Джокер', 'Однажды в Голливуде'], correctIndex: 1, difficulty: 2, tags: ['movies'] },
  { id: 'q5', text: 'Что означает аббревиатура НДС?', answers: ['Национальный доход страны', 'Налог на добавленную стоимость', 'Надёжный доход сбережений', 'Нормативный доход средств'], correctIndex: 1, difficulty: 1, tags: ['finance'] },
  { id: 'q6', text: 'Какая валюта используется в Японии?', answers: ['Юань', 'Вона', 'Йена', 'Донг'], correctIndex: 2, difficulty: 1, tags: ['finance', 'general'] },
  { id: 'q7', text: 'Кто написал «Войну и мир»?', answers: ['Достоевский', 'Чехов', 'Толстой', 'Тургенев'], correctIndex: 2, difficulty: 1, tags: ['general'] },
  { id: 'q8', text: 'Сколько минут длится футбольный матч (без остановок)?', answers: ['80', '90', '100', '120'], correctIndex: 1, difficulty: 1, tags: ['sport'] },
  { id: 'q9', text: 'В каком городе находится Эйфелева башня?', answers: ['Лондон', 'Берлин', 'Париж', 'Рим'], correctIndex: 2, difficulty: 1, tags: ['general'] },
  { id: 'q10', text: 'Какой химический элемент обозначается символом Au?', answers: ['Серебро', 'Золото', 'Алюминий', 'Медь'], correctIndex: 1, difficulty: 2, tags: ['science'] },
  { id: 'q11', text: 'Что такое инфляция?', answers: ['Рост цен', 'Падение курса валюты', 'Рост безработицы', 'Сокращение ВВП'], correctIndex: 0, difficulty: 1, tags: ['finance'] },
  { id: 'q12', text: 'Какой фильм снял Кристофер Нолан про сны?', answers: ['Интерстеллар', 'Начало', 'Престиж', 'Тёмный рыцарь'], correctIndex: 1, difficulty: 1, tags: ['movies'] },
  { id: 'q13', text: 'Как называется чувство взаимной привязанности между людьми?', answers: ['Эмпатия', 'Симпатия', 'Дружба', 'Уважение'], correctIndex: 2, difficulty: 1, tags: ['relationships'] },
  { id: 'q14', text: 'Когда распался СССР?', answers: ['1989', '1990', '1991', '1992'], correctIndex: 2, difficulty: 2, tags: ['history'] },
  { id: 'q15', text: 'Какой газ необходим растениям для фотосинтеза?', answers: ['Кислород', 'Азот', 'Углекислый газ', 'Водород'], correctIndex: 2, difficulty: 1, tags: ['science'] },
  { id: 'q16', text: 'Сколько очков даёт трёхочковый бросок в баскетболе?', answers: ['2', '3', '4', '5'], correctIndex: 1, difficulty: 1, tags: ['sport'] },
  { id: 'q17', text: 'Какой режиссёр снял «Титаник»?', answers: ['Спилберг', 'Кэмерон', 'Лукас', 'Нолан'], correctIndex: 1, difficulty: 1, tags: ['movies'] },
  { id: 'q18', text: 'Что такое диверсификация в инвестициях?', answers: ['Вложение в один актив', 'Распределение риска', 'Продажа всех активов', 'Покупка только акций'], correctIndex: 1, difficulty: 2, tags: ['finance'] },
  { id: 'q19', text: 'Кто первый полетел в космос?', answers: ['Нил Армстронг', 'Юрий Гагарин', 'Валентина Терешкова', 'Алан Шепард'], correctIndex: 1, difficulty: 1, tags: ['history', 'science'] },
  { id: 'q20', text: 'Какой остров самый большой в мире?', answers: ['Мадагаскар', 'Борнео', 'Гренландия', 'Новая Гвинея'], correctIndex: 2, difficulty: 2, tags: ['general'] },
  { id: 'q21', text: 'В каком году человек впервые ступил на Луну?', answers: ['1967', '1969', '1971', '1973'], correctIndex: 1, difficulty: 2, tags: ['history', 'science'] },
  { id: 'q22', text: 'Какой фильм получил «Золотую пальмовую ветвь» в Каннах в 2019?', answers: ['Паразиты', 'Маленькие женщины', 'Однажды в Голливуде', 'Джокер'], correctIndex: 0, difficulty: 3, tags: ['movies'] },
  { id: 'q23', text: 'Что такое эмоциональный интеллект?', answers: ['IQ тест', 'Способность понимать эмоции', 'Логическое мышление', 'Скорость реакции'], correctIndex: 1, difficulty: 2, tags: ['relationships'] },
  { id: 'q24', text: 'Какой процент годовых считается «нормальной» инфляцией в развитых странах?', answers: ['0-1%', '1-3%', '3-5%', '5-10%'], correctIndex: 1, difficulty: 2, tags: ['finance'] },
  { id: 'q25', text: 'Кто написал «Гамлета»?', answers: ['Чосер', 'Диккенс', 'Шекспир', 'Байрон'], correctIndex: 2, difficulty: 1, tags: ['general'] },
  { id: 'q26', text: 'Сколько сердец у осьминога?', answers: ['1', '2', '3', '4'], correctIndex: 2, difficulty: 2, tags: ['science'] },
  { id: 'q27', text: 'В какой стране проходили летние Олимпийские игры 2016?', answers: ['Китай', 'Великобритания', 'Бразилия', 'Россия'], correctIndex: 2, difficulty: 1, tags: ['sport'] },
  { id: 'q28', text: 'Что такое активное слушание в коммуникации?', answers: ['Молчание', 'Полное внимание и отзеркаливание', 'Быстрые ответы', 'Смена темы'], correctIndex: 1, difficulty: 2, tags: ['relationships'] },
  { id: 'q29', text: 'Какой металл имеет самую высокую температуру плавления?', answers: ['Железо', 'Платина', 'Вольфрам', 'Золото'], correctIndex: 2, difficulty: 3, tags: ['science'] },
  { id: 'q30', text: 'Что означает «Black Friday» в финансах?', answers: ['День выплаты зарплаты', 'Крах биржи', 'Рекламная акция', 'День закрытия сделок'], correctIndex: 1, difficulty: 2, tags: ['finance'] },
]

export function getQuestionsByTags(tags: string[], count: number): Question[] {
  const filtered = tags.length
    ? QUIZ_QUESTIONS.filter((q) => q.tags.some((t) => tags.includes(t)))
    : [...QUIZ_QUESTIONS]
  const shuffled = [...filtered].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

export function shuffleQuestions<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}
