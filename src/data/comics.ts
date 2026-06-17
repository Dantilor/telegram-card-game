export type ComicAccess = 'free' | 'premium'

export type ComicSeries = {
  id: string
  title: string
  subtitle: string
  description: string
  pagesCount: number
  access: ComicAccess
  isNew?: boolean
  /** Catalog card cover frame; default 2/3 */
  coverAspect?: '2/3' | '3/4'
}

export const COMIC_SERIES: ComicSeries[] = [
  {
    id: 'series-1',
    title: 'Серия 1',
    subtitle: 'Начало истории GNH',
    description: 'Первая серия комикса GameNight Host.',
    pagesCount: 16,
    access: 'free',
    isNew: false,
  },
  {
    id: 'series-2',
    title: 'Серия 2',
    subtitle: 'Необитаемый вайб',
    description: 'Продолжение комикса GNH с новым вечерним вайбом.',
    pagesCount: 16,
    access: 'free',
    isNew: false,
  },
  {
    id: 'series-3',
    title: 'Серия 3',
    subtitle: 'Бункерный вайб',
    description: 'Новая серия комикса GNH с героями, спорными решениями и Хостиком.',
    pagesCount: 16,
    access: 'free',
    isNew: true,
  },
  {
    id: 'series-4',
    title: 'Серия 4',
    subtitle: 'Дом с секретами',
    description: 'Комикс GNH про вечер, где у каждого есть что скрывать.',
    pagesCount: 16,
    access: 'premium',
    isNew: true,
  },
  {
    id: 'series-5',
    title: 'Серия 5',
    subtitle: 'Поезд без остановок',
    description: 'Новая серия GNH: история в поезде, который уже не свернет с маршрута.',
    pagesCount: 10,
    access: 'premium',
    isNew: true,
    coverAspect: '3/4',
  },
  {
    id: 'series-6',
    title: 'Серия 6',
    subtitle: 'Поезд без остановок. Часть 2',
    description: 'Продолжение истории GNH в поезде, где каждая остановка — уже поздно.',
    pagesCount: 10,
    access: 'premium',
    isNew: true,
    coverAspect: '3/4',
  },
  {
    id: 'series-7',
    title: 'Серия 7',
    subtitle: 'Сад больших приключений',
    description: 'Новая серия GNH: вечер в саду, где каждое решение растёт в настоящее приключение.',
    pagesCount: 10,
    access: 'premium',
    isNew: true,
    coverAspect: '3/4',
  },
  {
    id: 'series-8',
    title: 'Серия 8',
    subtitle: 'Космический рейс',
    description: 'Новая серия GNH: вечер уходит в космос, а Хостик уже знает, кто первым нажмёт на красную кнопку.',
    pagesCount: 10,
    access: 'premium',
    isNew: true,
    coverAspect: '3/4',
  },
  {
    id: 'series-9',
    title: 'Серия 9',
    subtitle: 'Пиксельный мир',
    description: 'Новая серия GNH: вечер превращается в игру, где каждый ход — настоящий выбор.',
    pagesCount: 10,
    access: 'premium',
    isNew: true,
    coverAspect: '3/4',
  },
  {
    id: 'series-10',
    title: 'Серия 10',
    subtitle: 'Динопарк',
    description: 'Новая серия GNH: вечер в парке, где приключения старше любых правил.',
    pagesCount: 10,
    access: 'premium',
    isNew: true,
    coverAspect: '3/4',
  },
]

export function getComicSeriesById(seriesId: string): ComicSeries | undefined {
  return COMIC_SERIES.find((s) => s.id === seriesId)
}
