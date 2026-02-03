import type { Card, CardType, CardLevel } from '../types'

const TRUTH_LEVEL_1: Card[] = [
  { id: 't1-1', type: 'truth', level: 1, text: 'Какой твой самый неловкий момент в школе?', tags: ['party', 'light'] },
  { id: 't1-2', type: 'truth', level: 1, text: 'Какое блюдо ты ешь как дикарь?', tags: ['party', 'light'] },
  { id: 't1-3', type: 'truth', level: 1, text: 'Кого ты тайно подписан в соцсетях?', tags: ['party', 'light'] },
  { id: 't1-4', type: 'truth', level: 1, text: 'Какой фильм ты пересматривал больше 5 раз?', tags: ['party', 'light'] },
  { id: 't1-5', type: 'truth', level: 1, text: 'Какая привычка тебя бесит в других?', tags: ['party', 'light'] },
  { id: 't1-6', type: 'truth', level: 1, text: 'Какой комплимент запомнился тебе больше всего?', tags: ['party', 'light'] },
  { id: 't1-7', type: 'truth', level: 1, text: 'Чего ты стыдишься, но это не страшно?', tags: ['party', 'light'] },
  { id: 't1-7a', type: 'truth', level: 1, text: 'Ты больше интроверт или экстраверт?', tags: ['light'] },
  { id: 't1-7b', type: 'truth', level: 1, text: 'Какой твой любимый способ отдохнуть?', tags: ['light'] },
  { id: 't1-7c', type: 'truth', level: 1, text: 'Что поднимает тебе настроение?', tags: ['light'] },
  { id: 't1-7d', type: 'truth', level: 1, text: 'Ты чаще планируешь или действуешь спонтанно?', tags: ['light'] },
  { id: 't1-7e', type: 'truth', level: 1, text: 'Что тебя радует в мелочах?', tags: ['light'] },
  { id: 't1-8', type: 'truth', level: 1, text: 'Какую песню ты включаешь, когда один?', tags: ['party', 'light'] },
  { id: 't1-9', type: 'truth', level: 1, text: 'О чём ты врёшь чаще всего?', tags: ['party', 'light'] },
  { id: 't1-10', type: 'truth', level: 1, text: 'Кого из присутствующих ты считаешь самым забавным?', tags: ['party', 'light'] },
  { id: 't1-11', type: 'truth', level: 1, text: 'Кто из присутствующих тебя больше всего удивил?', tags: ['party'] },
  { id: 't1-12', type: 'truth', level: 1, text: 'Что самое неловкое случалось с тобой на вечеринке?', tags: ['party'] },
  { id: 't1-13', type: 'truth', level: 1, text: 'Ты чаще заводишь или поддерживаешь веселье?', tags: ['party'] },
  { id: 't1-14', type: 'truth', level: 1, text: 'Какой момент вечера тебе уже нравится больше всего?', tags: ['party'] },
  { id: 't1-15', type: 'truth', level: 1, text: 'Что ты обычно делаешь, когда становится слишком шумно?', tags: ['party'] },
]

const TRUTH_LEVEL_2: Card[] = [
  { id: 't2-1', type: 'truth', level: 2, text: 'Расскажи о человеке, в которого ты был влюблён тайно.', tags: ['party', 'couples'] },
  { id: 't2-2', type: 'truth', level: 2, text: 'Какой поступок ты совершил и до сих пор краснеешь?', tags: ['party', 'light'] },
  { id: 't2-3', type: 'truth', level: 2, text: 'Кого из друзей ты бы позвал в первую очередь, если бы попал в беду?', tags: ['party'] },
  { id: 't2-4', type: 'truth', level: 2, text: 'Какой секрет ты хранишь от родителей?', tags: ['party', 'light'] },
  { id: 't2-5', type: 'truth', level: 2, text: 'О чём ты сожалеешь в отношениях?', tags: ['couples'] },
  { id: 't2-5a', type: 'truth', level: 1, text: 'Что тебе больше всего нравится в партнёре?', tags: ['couples'] },
  { id: 't2-5b', type: 'truth', level: 1, text: 'Когда ты понял(а), что это не просто симпатия?', tags: ['couples'] },
  { id: 't2-5c', type: 'truth', level: 1, text: 'Что для тебя важнее — слова или действия?', tags: ['couples'] },
  { id: 't2-5d', type: 'truth', level: 1, text: 'Какой совместный момент ты вспоминаешь чаще всего?', tags: ['couples'] },
  { id: 't2-5e', type: 'truth', level: 1, text: 'Что помогает вам мириться?', tags: ['couples'] },
  { id: 't2-6', type: 'truth', level: 2, text: 'Какую самую глупую покупку ты совершил?', tags: ['party', 'light'] },
  { id: 't2-7', type: 'truth', level: 2, text: 'Кому из присутствующих ты бы доверил секрет?', tags: ['party'] },
  { id: 't2-8', type: 'truth', level: 2, text: 'Какой момент из детства тебя до сих пор мучает?', tags: ['party', 'light'] },
  { id: 't2-9', type: 'truth', level: 2, text: 'Чего ты боишься больше всего в отношениях?', tags: ['couples'] },
  { id: 't2-10', type: 'truth', level: 2, text: 'Расскажи про случай, когда ты врал и тебя поймали.', tags: ['party', 'light'] },
]

const TRUTH_LEVEL_3: Card[] = [
  { id: 't3-1', type: 'truth', level: 3, text: 'Какую самую глупую вещь ты делал ради симпатии?', tags: ['party', 'couples', 'hard'] },
  { id: 't3-2', type: 'truth', level: 3, text: 'О ком из друзей ты ревнуешь или ревновал?', tags: ['party', 'hard'] },
  { id: 't3-3', type: 'truth', level: 3, text: 'Какой секрет ты никогда не расскажешь родителям?', tags: ['party', 'hard'] },
  { id: 't3-4', type: 'truth', level: 3, text: 'Чего ты стыдишься в своих прошлых отношениях?', tags: ['couples', 'hard'] },
  { id: 't3-5', type: 'truth', level: 3, text: 'Какой поступок ты совершил и жалеешь до сих пор?', tags: ['party', 'hard'] },
  { id: 't3-6', type: 'truth', level: 3, text: 'Кого из присутствующих ты считаешь привлекательным?', tags: ['party', 'hard'] },
  { id: 't3-7', type: 'truth', level: 3, text: 'Опиши самый неловкий момент на свидании.', tags: ['couples', 'hard'] },
  { id: 't3-8', type: 'truth', level: 3, text: 'Какой самый странный сон о ком-то из друзей ты видел?', tags: ['party', 'hard'] },
  { id: 't3-9', type: 'truth', level: 3, text: 'Чего ты стыдишься в себе и скрываешь?', tags: ['party', 'hard'] },
  { id: 't3-10', type: 'truth', level: 3, text: 'Расскажи о моменте, когда ты подвёл кого-то важного.', tags: ['party', 'hard'] },
  { id: 't3-11', type: 'truth', level: 2, text: 'Ты чаще говоришь правду или скрываешь её?', tags: ['hard'] },
  { id: 't3-12', type: 'truth', level: 2, text: 'Был ли момент, когда ты сильно сомневался в себе?', tags: ['hard'] },
  { id: 't3-13', type: 'truth', level: 2, text: 'Что тебя может по-настоящему выбить из колеи?', tags: ['hard'] },
  { id: 't3-14', type: 'truth', level: 2, text: 'Ты легко доверяешь людям?', tags: ['hard'] },
  { id: 't3-15', type: 'truth', level: 2, text: 'Как ты реагируешь на давление?', tags: ['hard'] },
]

const TRUTH_LEVEL_4: Card[] = [
  { id: 't4-1', type: 'truth', level: 4, text: 'Какую самую жёсткую правду о себе ты никогда не говорил вслух?', tags: ['party', 'hard'] },
  { id: 't4-2', type: 'truth', level: 4, text: 'О ком из присутствующих у тебя были романтические мысли?', tags: ['party', 'hard'] },
  { id: 't4-3', type: 'truth', level: 4, text: 'Какой поступок из прошлого ты считаешь самым низким?', tags: ['party', 'hard'] },
  { id: 't4-4', type: 'truth', level: 4, text: 'Чего ты боишься признаться даже себе?', tags: ['party', 'hard'] },
  { id: 't4-5', type: 'truth', level: 4, text: 'Расскажи о самом унизительном моменте в твоей жизни.', tags: ['party', 'hard'] },
  { id: 't4-6', type: 'truth', level: 4, text: 'Кого ты предал и до сих пор не можешь простить себя?', tags: ['party', 'hard'] },
  { id: 't4-7', type: 'truth', level: 4, text: 'Какая твоя самая тёмная мысль о ком-то из друзей?', tags: ['party', 'hard'] },
  { id: 't4-8', type: 'truth', level: 4, text: 'Опиши момент, когда ты соврал любимому человеку.', tags: ['couples', 'hard'] },
  { id: 't4-9', type: 'truth', level: 4, text: 'Чего ты никогда не простишь себе?', tags: ['party', 'hard'] },
  { id: 't4-10', type: 'truth', level: 4, text: 'Какой секрет ты унёс бы в могилу?', tags: ['party', 'hard'] },
  { id: 't4-11', type: 'truth', level: 2, text: 'Ты больше любишь флирт или прямоту?', tags: ['18plus'] },
  { id: 't4-12', type: 'truth', level: 2, text: 'Что для тебя важнее — атмосфера или искра?', tags: ['18plus'] },
  { id: 't4-13', type: 'truth', level: 2, text: 'Ты легко поддаёшься соблазну?', tags: ['18plus'] },
  { id: 't4-14', type: 'truth', level: 2, text: 'Что для тебя самый сильный знак внимания?', tags: ['18plus'] },
  { id: 't4-15', type: 'truth', level: 2, text: 'Ты предпочитаешь инициативу или отклик?', tags: ['18plus'] },
]

const DARE_LEVEL_1: Card[] = [
  { id: 'd1-1', type: 'dare', level: 1, text: 'Сделай комплимент каждому игроку.', tags: ['party', 'light'] },
  { id: 'd1-2', type: 'dare', level: 1, text: 'Спой куплет любой песни.', tags: ['party', 'light'] },
  { id: 'd1-3', type: 'dare', level: 1, text: 'Изобрази животное на выбор группы.', tags: ['party', 'light'] },
  { id: 'd1-4', type: 'dare', level: 1, text: 'Расскажи анекдот.', tags: ['party', 'light'] },
  { id: 'd1-5', type: 'dare', level: 1, text: 'Сделай селфи с дурацкой рожицей.', tags: ['party', 'light'] },
  { id: 'd1-6', type: 'dare', level: 1, text: 'Позвони кому-то и спой "С днём рождения".', tags: ['party', 'light'] },
  { id: 'd1-7', type: 'dare', level: 1, text: 'Протанцуй 30 секунд без музыки.', tags: ['party', 'light'] },
  { id: 'd1-7a', type: 'dare', level: 1, text: 'Улыбнись всем игрокам.', tags: ['light'] },
  { id: 'd1-7b', type: 'dare', level: 1, text: 'Назови три вещи, которые тебе нравятся сегодня.', tags: ['light'] },
  { id: 'd1-7c', type: 'dare', level: 1, text: 'Покажи жестом своё настроение.', tags: ['light'] },
  { id: 'd1-7d', type: 'dare', level: 1, text: 'Выбери игрока и пожелай ему что-то хорошее.', tags: ['light'] },
  { id: 'd1-7e', type: 'dare', level: 1, text: 'Сделай глубокий вдох и выдох.', tags: ['light'] },
  { id: 'd1-8', type: 'dare', level: 1, text: 'Скажи вслух три своих недостатка.', tags: ['party', 'light'] },
  { id: 'd1-9', type: 'dare', level: 1, text: 'Обними того, кто сидит слева.', tags: ['party', 'light'] },
  { id: 'd1-10', type: 'dare', level: 1, text: 'Покажи свою самую смешную фотографию в телефоне.', tags: ['party', 'light'] },
  { id: 'd1-11', type: 'dare', level: 1, text: 'Изобрази самое нелепое танцевальное движение.', tags: ['party'] },
  { id: 'd1-12', type: 'dare', level: 1, text: 'Скажи тост за компанию.', tags: ['party'] },
  { id: 'd1-13', type: 'dare', level: 1, text: 'Выбери игрока и придумай ему вечеринское прозвище.', tags: ['party'] },
  { id: 'd1-14', type: 'dare', level: 1, text: 'Сделай вид, что ты ведущий вечеринки.', tags: ['party'] },
  { id: 'd1-15', type: 'dare', level: 1, text: 'Изобрази, как ты уходишь с вечеринки под аплодисменты.', tags: ['party'] },
]

const DARE_LEVEL_2: Card[] = [
  { id: 'd2-1', type: 'dare', level: 2, text: 'Прочитай последнее сообщение в чате вслух.', tags: ['party', 'light'] },
  { id: 'd2-2', type: 'dare', level: 2, text: 'Позвони родителям и скажи, что любишь их.', tags: ['party', 'light'] },
  { id: 'd2-3', type: 'dare', level: 2, text: 'Съешь что-то без рук.', tags: ['party', 'light'] },
  { id: 'd2-4', type: 'dare', level: 2, text: 'Попроси у незнакомца номер телефона (можно в шутку).', tags: ['party'] },
  { id: 'd2-5', type: 'dare', level: 2, text: 'Станцуй с тем, кого выберет группа.', tags: ['party', 'couples'] },
  { id: 'd2-5a', type: 'dare', level: 1, text: 'Скажи партнёру комплимент.', tags: ['couples'] },
  { id: 'd2-5b', type: 'dare', level: 1, text: 'Возьми партнёра за руку на 10 секунд.', tags: ['couples'] },
  { id: 'd2-5c', type: 'dare', level: 1, text: 'Скажи одну фразу, за что ты благодарен(на).', tags: ['couples'] },
  { id: 'd2-5d', type: 'dare', level: 1, text: 'Посмотри в глаза партнёру 15 секунд.', tags: ['couples'] },
  { id: 'd2-5e', type: 'dare', level: 1, text: 'Придумай мини-план идеального вечера.', tags: ['couples'] },
  { id: 'd2-6', type: 'dare', level: 2, text: 'Покажи экран телефона группе на 10 секунд.', tags: ['party'] },
  { id: 'd2-7', type: 'dare', level: 2, text: 'Сделай массаж плеч соседу 1 минуту.', tags: ['party', 'couples'] },
  { id: 'd2-8', type: 'dare', level: 2, text: 'Скажи комплимент сидящему напротив, глядя в глаза.', tags: ['party', 'couples'] },
  { id: 'd2-9', type: 'dare', level: 2, text: 'Произнеси тост за каждого игрока.', tags: ['party'] },
  { id: 'd2-10', type: 'dare', level: 2, text: 'Опиши себя тремя словами — так, как сказали бы о тебе враги.', tags: ['party', 'hard'] },
]

const DARE_LEVEL_3: Card[] = [
  { id: 'd3-1', type: 'dare', level: 3, text: 'Съешь ложку чего-то без объяснения (выбирает группа).', tags: ['party', 'hard'] },
  { id: 'd3-2', type: 'dare', level: 3, text: 'Позвони бывшему/бывшей и скажи что-то нейтральное.', tags: ['party', 'hard'] },
  { id: 'd3-3', type: 'dare', level: 3, text: 'Поцелуй кого-то в щёку (согласие обязательно).', tags: ['party', 'couples'] },
  { id: 'd3-4', type: 'dare', level: 3, text: 'Опубликуй в сторис что-то постыдное (можно удалить через минуту).', tags: ['party', 'hard'] },
  { id: 'd3-5', type: 'dare', level: 3, text: 'Разреши группе посмотреть историю поиска (последние 5 запросов).', tags: ['party', 'hard'] },
  { id: 'd3-6', type: 'dare', level: 3, text: 'Станцуй стриптиз (шутливо, без раздевания) 30 секунд.', tags: ['party', 'hard'] },
  { id: 'd3-7', type: 'dare', level: 3, text: 'Скажи что-то романтическое тому, кого выберет группа.', tags: ['party', 'couples'] },
  { id: 'd3-8', type: 'dare', level: 3, text: 'Позвони другу и признайся в любви (шутка).', tags: ['party', 'hard'] },
  { id: 'd3-9', type: 'dare', level: 3, text: 'Разреши сфоткать тебя в нелепой позе и пусть выложат в общий чат.', tags: ['party', 'hard'] },
  { id: 'd3-10', type: 'dare', level: 3, text: 'Расскажи историю, о которой ты никогда не говорил.', tags: ['party', 'hard'] },
  { id: 'd3-11', type: 'dare', level: 2, text: 'Ответь честно на следующий вопрос без объяснений.', tags: ['hard'] },
  { id: 'd3-12', type: 'dare', level: 2, text: 'Сделай выбор между двумя вариантами (ведущий решает).', tags: ['hard'] },
  { id: 'd3-13', type: 'dare', level: 2, text: 'Назови одно своё слабое место.', tags: ['hard'] },
  { id: 'd3-14', type: 'dare', level: 2, text: 'Скажи, что тебе сейчас даётся сложнее всего.', tags: ['hard'] },
  { id: 'd3-15', type: 'dare', level: 2, text: 'Признайся в том, что обычно скрываешь (без деталей).', tags: ['hard'] },
]

const DARE_LEVEL_4: Card[] = [
  { id: 'd4-1', type: 'dare', level: 4, text: 'Позвони незнакомому номеру и спой серенаду.', tags: ['party', 'hard'] },
  { id: 'd4-2', type: 'dare', level: 4, text: 'Признайся в чём-то постыдном вслух всей группе.', tags: ['party', 'hard'] },
  { id: 'd4-3', type: 'dare', level: 4, text: 'Сделай предложение руки и сердца соседу (шутка).', tags: ['party', 'hard'] },
  { id: 'd4-4', type: 'dare', level: 4, text: 'Разреши группе написать пост от твоего имени в соцсеть.', tags: ['party', 'hard'] },
  { id: 'd4-5', type: 'dare', level: 4, text: 'Спой дуэтом с тем, кого выберет группа.', tags: ['party', 'hard'] },
  { id: 'd4-6', type: 'dare', level: 4, text: 'Покажи последние 3 фото в галерее группе.', tags: ['party', 'hard'] },
  { id: 'd4-7', type: 'dare', level: 4, text: 'Станцуй танец на коленях перед группой.', tags: ['party', 'hard'] },
  { id: 'd4-8', type: 'dare', level: 4, text: 'Прочитай последние 5 сообщений в личке вслух.', tags: ['party', 'hard'] },
  { id: 'd4-9', type: 'dare', level: 4, text: 'Признайся в симпатии тому, на кого укажет группа.', tags: ['party', 'couples', 'hard'] },
  { id: 'd4-10', type: 'dare', level: 4, text: 'Сделай что-то, о чём попросит группа (в разумных пределах).', tags: ['party', 'hard'] },
  { id: 'd4-11', type: 'dare', level: 2, text: 'Скажи кому-то комплимент с намёком.', tags: ['18plus'] },
  { id: 'd4-12', type: 'dare', level: 2, text: 'Посмотри на выбранного игрока и улыбнись.', tags: ['18plus'] },
  { id: 'd4-13', type: 'dare', level: 2, text: 'Произнеси фразу «Ты мне нравишься» в своём стиле.', tags: ['18plus'] },
  { id: 'd4-14', type: 'dare', level: 2, text: 'Изобрази уверенность без слов.', tags: ['18plus'] },
  { id: 'd4-15', type: 'dare', level: 2, text: 'Придумай романтическую сцену без описаний.', tags: ['18plus'] },
]

export const ALL_CARDS: Card[] = [
  ...TRUTH_LEVEL_1,
  ...TRUTH_LEVEL_2,
  ...TRUTH_LEVEL_3,
  ...TRUTH_LEVEL_4,
  ...DARE_LEVEL_1,
  ...DARE_LEVEL_2,
  ...DARE_LEVEL_3,
  ...DARE_LEVEL_4,
]

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

export function pickCard(
  type: CardType,
  level: CardLevel,
  tags: string[],
  usedIds: string[]
): Card | null {
  let pool = ALL_CARDS.filter(
    (c) =>
      c.type === type &&
      c.level === level &&
      !usedIds.includes(c.id) &&
      (tags.length === 0 || c.tags.some((t) => tags.includes(t)))
  )
  if (pool.length === 0) {
    pool = ALL_CARDS.filter(
      (c) =>
        c.type === type &&
        c.level === level &&
        !usedIds.includes(c.id)
    )
  }
  if (pool.length === 0) {
    const fallback = ALL_CARDS.filter((c) => c.type === type && !usedIds.includes(c.id))
    if (fallback.length === 0) return null
    const byLevel = fallback.sort((a, b) => Math.abs(a.level - level) - Math.abs(b.level - level))
    return byLevel[0] ?? null
  }
  const shuffled = shuffle(pool)
  return shuffled[0] ?? null
}

export function pickShameCard(
  type: CardType,
  level: CardLevel,
  tags: string[],
  usedIds: string[]
): Card | null {
  return pickCard(type, level, tags, usedIds)
}
