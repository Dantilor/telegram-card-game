/**
 * Public WEB SEO content (play.gamenighthost.ru).
 * Shared by the build-time prerender (vite.config.ts) and the React /discover pages.
 * Must stay DOM-free: it is also type-checked under tsconfig.node.json.
 * Every game fact here mirrors in-app rules/setup code — do not add invented numbers.
 */

export const SITE_ORIGIN = 'https://play.gamenighthost.ru'
export const SITE_NAME = 'GameNight Host'
export const DEFAULT_OG_IMAGE = '/og/gnh-default.jpg'
export const DEFAULT_OG_IMAGE_ALT = 'GameNight Host — онлайн-игры для компании и друзей'
/** Date the public SEO content was last edited (used as sitemap lastmod). */
export const SEO_CONTENT_UPDATED = '2026-11-24'

export type SeoGameAccess = 'free' | 'free-decks' | 'host-premium' | 'premium'

export type SeoGame = {
  id: string
  title: string
  route: string
  players?: string
  format: string
  access: SeoGameAccess
  summary: string
}

export const SEO_GAME_ACCESS_LABEL: Record<SeoGameAccess, string> = {
  free: 'Бесплатно',
  'free-decks': 'Бесплатные колоды + Premium',
  'host-premium': 'Вход по коду бесплатно · комнату создаёт Premium',
  premium: 'Premium',
}

export const SEO_GAMES: Record<string, SeoGame> = {
  card: {
    id: 'card',
    title: 'GameNight Cards',
    route: '/card',
    format: 'Колоды вопросов на одном экране',
    access: 'free-decks',
    summary:
      'Колоды вопросов для пары и компании. Бесплатно открыты «Реальность нашей пары» и «Эмоциональный вайб» для двоих, «Самый вероятный» и «Анатомия дружбы» (18+) для компании — по 15 вопросов в каждой.',
  },
  mafia: {
    id: 'mafia',
    title: 'Мафия Lite',
    route: '/mafia',
    players: '4–14 игроков',
    format: 'Один телефон и ведущий',
    access: 'premium',
    summary:
      'Классическая мафия с ведущим: мафия, доктор, шериф и мирные. Телефон передают по кругу, чтобы каждый тайно увидел роль. Ночью ходят мафия, доктор и шериф, днём — обсуждение на 90 секунд и голосование.',
  },
  'mafia-shadows': {
    id: 'mafia-shadows',
    title: 'Мафия: Тени города',
    route: '/mafia-shadows',
    players: '4–14 игроков',
    format: 'Каждый со своего телефона, вход по коду',
    access: 'host-premium',
    summary:
      'Онлайн-комната, где тайная роль видна только на вашем телефоне: Дон, Тень мафии, Детектив, Доктор и Жители, а с 5 игроков — Одиночка. Ночь, утро с обсуждением и суд города.',
  },
  alias: {
    id: 'alias',
    title: 'Ассоциации',
    route: '/alias',
    players: '2–6 команд по 2+ человека',
    format: 'Один телефон, командная игра',
    access: 'premium',
    summary:
      'Объясняйте слова жестами или описанием, без однокоренных слов, пока идёт таймер на 30, 45 или 60 секунд. Категории: База, Кино, Мемы, Профессии, Ситуации и 18+.',
  },
  activity: {
    id: 'activity',
    title: 'Активитус',
    route: '/activity',
    players: '2–6 команд по 2+ человека',
    format: 'Один телефон, бумага и ручка',
    access: 'premium',
    summary:
      'Игрок получает слово и формат: показать, объяснить или нарисовать. Команда угадывает, за каждый верный ответ — балл. Таймер на 30, 45 или 60 секунд.',
  },
  sabotage: {
    id: 'sabotage',
    title: 'Саботаж',
    route: '/sabotage',
    players: '3–10 игроков',
    format: 'Один телефон',
    access: 'premium',
    summary:
      'Все получают одно задание, но один игрок тайно становится Саботёром и аккуратно мешает. После таймера на 3–5 минут — голосование и раскрытие.',
  },
  quiz: {
    id: 'quiz',
    title: 'Битва умов',
    route: '/quiz',
    players: '2–8 участников',
    format: 'Один телефон',
    access: 'free',
    summary:
      'Викторина по темам: Кино, Общее, Финансы, Отношения, История, Наука и Спорт. 5, 10 или 20 вопросов, за верный ответ — баллы, побеждает набравший больше.',
  },
  'truth-dare': {
    id: 'truth-dare',
    title: 'Правда или действие',
    route: '/truth-dare',
    players: '2–8 игроков',
    format: 'Один телефон',
    access: 'premium',
    summary:
      'Выбирайте правду или действие: 10, 20 или 30 ходов. Есть наборы для компании и отдельные наборы для пары; откровенные режимы открываются только после подтверждения 18+.',
  },
  'who-is-who': {
    id: 'who-is-who',
    title: 'Кто тут кто?',
    route: '/who-is-who',
    players: '3–5 игроков',
    format: 'Один телефон',
    access: 'premium',
    summary:
      'Вы читаете смешную ситуацию из жизни и решаете, кто из друзей больше похож на каждого героя сцены. У назначенного игрока — 15 секунд на оправдание.',
  },
  'phrase-translator': {
    id: 'phrase-translator',
    title: 'Переводчик фраз',
    route: '/phrase-translator',
    players: '3–10 игроков',
    format: 'Телефон по кругу',
    access: 'premium',
    summary:
      'Странная фраза — каждый предлагает свой «перевод», затем все голосуют за самый смешной или жизненный вариант. 5, 7 или 10 раундов.',
  },
  'freebie-trash': {
    id: 'freebie-trash',
    title: 'Фигня но бесплатно',
    route: '/freebie-trash',
    format: 'Один телефон',
    access: 'premium',
    summary:
      'Вам предлагают странную, смешную или сомнительную вещь бесплатно. Решайте: забираете или отказываетесь — и объясняйте компании, почему.',
  },
  'russia-travel': {
    id: 'russia-travel',
    title: 'Где мы?',
    route: '/russia-travel',
    format: 'Один телефон',
    access: 'premium',
    summary: 'Выбирайте маршрут, угадывайте города, открывайте места и спорьте о фактах о России вместе с компанией.',
  },
  sled: {
    id: 'sled',
    title: 'СЛЕД',
    route: '/sled',
    players: '3–8 игроков',
    format: 'Экран ведущего и телефоны игроков, вход по коду',
    access: 'host-premium',
    summary:
      'Кооперативный детектив на 10 дел: ведущий создаёт комнату, игроки входят с телефонов по коду и вместе ищут улики. 15–30 минут на дело.',
  },
  doubles: {
    id: 'doubles',
    title: 'Двойники',
    route: '/doubles',
    players: '4–12 игроков',
    format: 'Каждый со своего телефона, вход по коду',
    access: 'host-premium',
    summary:
      'Тайные досье и претенденты на одну личность. Задавайте вопросы вслух, ищите несовпадения в ответах и решайте, кто настоящий.',
  },
  infected: {
    id: 'infected',
    title: 'Заражённые',
    route: '/infected',
    players: '4–12 игроков',
    format: 'Каждый со своего телефона, вход по коду',
    access: 'host-premium',
    summary:
      'Игра на недоверие на станции: экипаж выполняет протоколы, заражённые тайно их срывают, совет голосует за карантин. Партия — около 25–40 минут.',
  },
}

/** Catalog order for the /games prerender (matches the in-app catalog groups). */
export const SEO_CATALOG_ORDER = [
  'mafia-shadows',
  'sled',
  'doubles',
  'infected',
  'card',
  'mafia',
  'alias',
  'activity',
  'sabotage',
  'quiz',
  'truth-dare',
  'who-is-who',
  'phrase-translator',
  'freebie-trash',
  'russia-travel',
] as const

export type SeoSection = {
  heading: string
  paragraphs?: string[]
  bullets?: string[]
  steps?: string[]
}

export type SeoPageKind = 'home' | 'catalog' | 'landing'

export type SeoPage = {
  kind: SeoPageKind
  path: string
  /** Short label for breadcrumbs and related links. */
  label: string
  title: string
  description: string
  h1: string
  lead: string
  ogImage: string
  ogImageAlt: string
  updated: string
  gamesHeading?: string
  games?: { id: string; note?: string }[]
  sections?: SeoSection[]
  cta: { label: string; href: string }
}

export const PRICING_SECTION: SeoSection = {
  heading: 'Что бесплатно, а что в Premium',
  bullets: [
    'Бесплатно: викторина «Битва умов» и четыре колоды GameNight Cards по 15 вопросов.',
    'В онлайн-играх со своими телефонами («Мафия: Тени города», «СЛЕД», «Двойники», «Заражённые») игроки подключаются по коду комнаты бесплатно — Premium нужен только тому, кто создаёт комнату.',
    'Premium открывает все игры, колоды и 18+ режимы. Оформляется без автопродления.',
  ],
}

export const HOME_PAGE: SeoPage = {
  kind: 'home',
  path: '/',
  label: 'Главная',
  title: 'GameNight Host — онлайн-игры для компании и друзей',
  description:
    'Мафия, Ассоциации, Саботаж и другие игры для компании, пары и вечеринки. Бесплатные игры и Premium-режимы. Соберите друзей и начинайте играть.',
  h1: 'Игры для компании, друзей и незабываемых вечеров',
  lead:
    'GameNight Host — сборник игр для живой встречи: мафия, детективы, Ассоциации, викторина, вопросы для пары и смешные карточки для вечеринки. Играйте с одного телефона или подключайте друзей по коду комнаты.',
  ogImage: DEFAULT_OG_IMAGE,
  ogImageAlt: DEFAULT_OG_IMAGE_ALT,
  updated: SEO_CONTENT_UPDATED,
  gamesHeading: 'Популярные игры',
  games: [
    { id: 'mafia-shadows' },
    { id: 'sled' },
    { id: 'infected' },
    { id: 'alias' },
    { id: 'quiz' },
    { id: 'card' },
  ],
  sections: [
    {
      heading: 'Как начать',
      steps: [
        'Откройте каталог и выберите игру под компанию и настроение.',
        'Для игр на одном телефоне введите имена игроков и передавайте устройство по кругу.',
        'Для онлайн-игр создайте комнату и покажите друзьям код — каждый играет со своего телефона.',
      ],
    },
    PRICING_SECTION,
  ],
  cta: { label: 'Открыть каталог игр', href: '/games' },
}

export const CATALOG_PAGE: SeoPage = {
  kind: 'catalog',
  path: '/games',
  label: 'Каталог игр',
  title: 'Каталог игр: мафия, детективы, игры для компании | GameNight Host',
  description:
    'Все игры GameNight Host: Мафия, СЛЕД, Двойники, Заражённые, Ассоциации, Активитус, Саботаж, викторина и вопросы для пары. Правила, число игроков и доступ.',
  h1: 'Каталог игр GameNight Host',
  lead:
    'Игры для компании, пары и вечеринки. В каждой карточке — формат, число игроков и что доступно бесплатно.',
  ogImage: DEFAULT_OG_IMAGE,
  ogImageAlt: DEFAULT_OG_IMAGE_ALT,
  updated: SEO_CONTENT_UPDATED,
  gamesHeading: 'Все игры',
  games: SEO_CATALOG_ORDER.map((id) => ({ id })),
  sections: [PRICING_SECTION],
  cta: { label: 'Начать играть', href: '/games' },
}

export const LANDING_PAGES: SeoPage[] = [
  {
    kind: 'landing',
    path: '/discover/igry-dlya-kompanii',
    label: 'Игры для компании',
    title: 'Игры для компании: мафия, детективы, Ассоциации | GameNight Host',
    description:
      'Игры для компании друзей на одном телефоне или по коду комнаты: Мафия, детектив СЛЕД, Заражённые, Ассоциации, Саботаж и викторина. Правила и число игроков.',
    h1: 'Игры для компании друзей',
    lead:
      'Подборка игр GameNight Host для встречи от трёх человек: социальные игры с тайными ролями, командные игры на объяснение слов и спокойные форматы вроде викторины.',
    ogImage: '/og/discover-igry-dlya-kompanii.jpg',
    ogImageAlt: 'Игры для компании — GameNight Host',
    updated: SEO_CONTENT_UPDATED,
    gamesHeading: 'Во что поиграть компанией',
    games: [
      { id: 'mafia-shadows', note: 'Когда у всех есть телефоны и хочется интриги.' },
      { id: 'sled', note: 'Если компании ближе совместное расследование, а не споры.' },
      { id: 'infected', note: 'Для тех, кто любит недоверие и голосования.' },
      { id: 'doubles', note: 'Для компании, которая любит каверзные вопросы.' },
      { id: 'alias', note: 'Классика для командной игры на одном телефоне.' },
      { id: 'sabotage', note: 'Короткие раунды с одним тайным вредителем.' },
      { id: 'who-is-who', note: 'Для небольшой компании от 3 до 5 человек.' },
      { id: 'quiz', note: 'Бесплатная викторина для спокойного начала вечера.' },
    ],
    sections: [
      {
        heading: 'Как выбрать игру',
        bullets: [
          'Один телефон на всех — Ассоциации, Саботаж, «Кто тут кто?» и «Битва умов».',
          'У каждого свой телефон — «Мафия: Тени города», «СЛЕД», «Двойники» и «Заражённые»: друзья входят по 6-значному коду комнаты.',
          'Большая компания — «Мафия: Тени города» рассчитана на 4–14 игроков, «Двойники» и «Заражённые» — на 4–12.',
        ],
      },
      PRICING_SECTION,
    ],
    cta: { label: 'Выбрать игру в каталоге', href: '/games' },
  },
  {
    kind: 'landing',
    path: '/discover/mafiya-onlajn',
    label: 'Мафия онлайн',
    title: 'Мафия онлайн: Мафия Lite и «Тени города» | GameNight Host',
    description:
      'Две версии мафии: Мафия Lite с ведущим на одном телефоне и «Мафия: Тени города», где каждый играет со своего телефона. Роли, правила и число игроков.',
    h1: 'Мафия онлайн для компании',
    lead:
      'В GameNight Host две разные мафии. Мафия Lite — классика с ведущим и одним телефоном на всех. «Мафия: Тени города» — онлайн-комната, где роль видна только на вашем телефоне.',
    ogImage: '/og/discover-mafiya-onlajn.jpg',
    ogImageAlt: 'Мафия онлайн — GameNight Host',
    updated: SEO_CONTENT_UPDATED,
    gamesHeading: 'Две версии мафии',
    games: [{ id: 'mafia' }, { id: 'mafia-shadows' }],
    sections: [
      {
        heading: 'Мафия Lite: как играть',
        steps: [
          'Выберите от 4 до 14 игроков и введите имена. Ведущий не играет — он объявляет фазы.',
          'Передайте телефон каждому игроку по очереди, чтобы он увидел свою роль.',
          'Ночью по очереди: мафия → доктор → шериф.',
          'Днём ведущий объявляет итог ночи, затем обсуждение и голосование.',
          'Мирные побеждают, когда вся мафия исключена. Мафия побеждает, когда мафий столько же или больше, чем мирных.',
        ],
      },
      {
        heading: '«Мафия: Тени города»: как играть',
        steps: [
          'Создатель открывает комнату и показывает код. Друзья входят по коду со своих телефонов — от 4 до 14 игроков.',
          'Каждый получает тайную роль: Дон и Тени мафии, Детектив, Доктор, Жители; с 5 игроков появляется Одиночка.',
          'Город засыпает: тайные ходы делаются на своих телефонах.',
          'Утро и обсуждение, затем суд города — голосование.',
        ],
      },
      {
        heading: 'Чем они отличаются',
        bullets: [
          'Мафия Lite — один телефон и отдельный ведущий; подходит, когда не у всех есть смартфон под рукой.',
          '«Тени города» — без передачи телефона: роли и ночные ходы тайные, ход игры ведёт создатель комнаты.',
          'Мафия Lite входит в Premium. В «Тени города» гости заходят по коду бесплатно, Premium нужен создателю комнаты.',
        ],
      },
    ],
    cta: { label: 'Открыть «Мафия: Тени города»', href: '/mafia-shadows' },
  },
  {
    kind: 'landing',
    path: '/discover/igry-dlya-dvoih',
    label: 'Игры для двоих',
    title: 'Игры для двоих: вопросы для пары, правда или действие | GameNight Host',
    description:
      'Игры для пары и свидания: колоды вопросов GameNight Cards, викторина «Битва умов» и «Правда или действие» с наборами для двоих. Бесплатные колоды и Premium.',
    h1: 'Игры для двоих',
    lead:
      'Форматы GameNight Host, в которые удобно играть вдвоём: вопросы, чтобы лучше узнать друг друга, викторина на эрудицию и «Правда или действие» с отдельными наборами для пары.',
    ogImage: '/og/discover-igry-dlya-dvoih.jpg',
    ogImageAlt: 'Игры для двоих — GameNight Host',
    updated: SEO_CONTENT_UPDATED,
    gamesHeading: 'Во что поиграть вдвоём',
    games: [
      {
        id: 'card',
        note: 'Режим «Вечер вдвоём»: две бесплатные колоды по 15 вопросов, ещё пять — в Premium. Режим «Свидания» — в Premium.',
      },
      { id: 'quiz', note: 'Подходит от двух участников, бесплатно.' },
      { id: 'truth-dare', note: 'Наборы «Сближение» и «Страсть» сделаны для пары и открываются после подтверждения 18+.' },
    ],
    sections: [
      {
        heading: 'Как играть вдвоём',
        steps: [
          'Откройте GameNight Cards и выберите режим «Вечер вдвоём».',
          'Начните с бесплатных колод «Реальность нашей пары» и «Эмоциональный вайб».',
          'Отвечайте по очереди и не торопитесь — вопросы рассчитаны на разговор, а не на скорость.',
        ],
      },
      PRICING_SECTION,
    ],
    cta: { label: 'Открыть GameNight Cards', href: '/card' },
  },
  {
    kind: 'landing',
    path: '/discover/igry-dlya-vecherinki',
    label: 'Игры для вечеринки',
    title: 'Игры для вечеринки: Активитус, Ассоциации и другие | GameNight Host',
    description:
      'Весёлые игры для вечеринки на одном телефоне: Активитус, Ассоциации, «Правда или действие», «Переводчик фраз», «Фигня но бесплатно» и «Кто тут кто?».',
    h1: 'Игры для вечеринки',
    lead:
      'Игры, которые не требуют подготовки: достаточно одного телефона, компании и желания посмеяться. Для «Активитуса» пригодятся бумага и ручка.',
    ogImage: '/og/discover-igry-dlya-vecherinki.jpg',
    ogImageAlt: 'Игры для вечеринки — GameNight Host',
    updated: SEO_CONTENT_UPDATED,
    gamesHeading: 'Что запустить на вечеринке',
    games: [
      { id: 'activity' },
      { id: 'alias' },
      { id: 'truth-dare' },
      { id: 'phrase-translator' },
      { id: 'freebie-trash' },
      { id: 'who-is-who' },
      { id: 'card', note: 'Режим «Компания»: бесплатные колоды «Самый вероятный» и «Анатомия дружбы» (18+).' },
    ],
    sections: [
      {
        heading: 'Как устроить игровой вечер',
        steps: [
          'Начните с командной игры — Активитус или Ассоциации быстро разогревают компанию.',
          'Дальше — игры на голосование: «Переводчик фраз» и «Кто тут кто?».',
          'Для смелого финала — «Правда или действие»; откровенные режимы открываются только после подтверждения 18+.',
        ],
      },
      PRICING_SECTION,
    ],
    cta: { label: 'Выбрать игру в каталоге', href: '/games' },
  },
  {
    kind: 'landing',
    path: '/discover/associacii-alias',
    label: 'Ассоциации',
    title: 'Ассоциации — игра «объясни слово» в стиле Alias | GameNight Host',
    description:
      'Ассоциации — командная игра на объяснение слов в стиле Alias: 2–6 команд, таймер 30, 45 или 60 секунд, категории База, Кино, Мемы, Профессии, Ситуации и 18+.',
    h1: 'Ассоциации — объясни слово своей команде',
    lead:
      'Командная игра на одном телефоне: игрок объясняет слова без однокоренных, команда угадывает, пока идёт таймер. Никаких однокоренных слов — только логика.',
    ogImage: '/og/discover-associacii-alias.jpg',
    ogImageAlt: 'Ассоциации — GameNight Host',
    updated: SEO_CONTENT_UPDATED,
    gamesHeading: 'Игры на объяснение слов',
    games: [{ id: 'alias' }, { id: 'activity', note: 'Похожая игра, где слово можно ещё показать или нарисовать.' }],
    sections: [
      {
        heading: 'Правила Ассоциаций',
        steps: [
          'Выберите категории и разделитесь на команды: от 2 до 6 команд, в каждой минимум 2 человека.',
          'Игрок объясняет слова жестами или описанием, без однокоренных слов.',
          'Таймер раунда — 30, 45 или 60 секунд. Угаданное слово засчитывается, неудобное можно пропустить.',
          'За каждый верный ответ — балл. Побеждает команда с большим счётом.',
        ],
      },
      {
        heading: 'Категории слов',
        bullets: [
          'База и Ситуации — для любой компании.',
          'Кино, Мемы и Профессии — тематические наборы.',
          '18+ — только после подтверждения возраста.',
        ],
      },
      PRICING_SECTION,
    ],
    cta: { label: 'Открыть Ассоциации', href: '/alias' },
  },
]

export const SEO_PAGES: SeoPage[] = [HOME_PAGE, CATALOG_PAGE, ...LANDING_PAGES]

export function findLandingBySlug(slug: string): SeoPage | undefined {
  return LANDING_PAGES.find((page) => page.path === `/discover/${slug}`)
}

export function findSeoPage(pathname: string): SeoPage | undefined {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return SEO_PAGES.find((page) => page.path === normalized)
}