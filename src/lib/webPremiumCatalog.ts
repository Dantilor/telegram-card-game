import { useMemo } from 'react'
import { GAMES, type Game } from '../data/games'
import { FREE_GAMES } from '../config/premium'
import type { CatalogGame, PremiumPlan } from '../components/gnh-premium-wheel/gnh-experience'

export type ApiPlan = {
  id: string
  title: string
  priceRub: number
  durationDays: number
  audience?: string
}

const FREE = new Set<string>(FREE_GAMES)

function parsePlayers(label?: string): [number, number] {
  if (!label) return [2, 8]
  const m = label.match(/(\d+)\s*[–-]\s*(\d+)/)
  if (m) return [Number(m[1]), Number(m[2])]
  const one = label.match(/(\d+)/)
  if (one) {
    const n = Number(one[1])
    return [n, n]
  }
  return [2, 8]
}

function moodsFor(game: Game): CatalogGame['moods'] {
  const id = game.id
  if (id.includes('mafia') || id === 'sabotage' || id === 'sled' || id === 'infected' || id === 'doubles') {
    return ['mystery', 'fun']
  }
  if (id === 'card' || id === 'truth-dare' || id.includes('who')) return ['close', 'fun']
  if (id === 'quiz' || id === 'alias' || id === 'phrase-translator') return ['brain', 'fun']
  if (id === 'activity' || id === 'russia-travel') return ['fun', 'close']
  return ['fun']
}

function minutesFor(game: Game): number {
  if (game.id === 'mafia-shadows') return 40
  if (game.id === 'sled') return 40
  if (game.id === 'mafia') return 45
  if (game.id === 'who-is-who') return 20
  if (game.id === 'russia-travel') return 15
  if (game.id === 'card') return 30
  return 25
}

/** Showcase order matching the Premium kit reference. */
export const WEB_PREMIUM_FEATURED_IDS = [
  'mafia-shadows',
  'who-is-who',
  'card',
  'sled',
  'russia-travel',
] as const

function wheelLabel(title: string): string | undefined {
  if (title.includes(':')) {
    const [a, b] = title.split(':')
    return `${a.trim()}|${(b || '').trim()}`
  }
  if (title.length > 16) {
    const parts = title.split(' ')
    if (parts.length >= 2) return `${parts[0]}|${parts.slice(1).join(' ')}`
  }
  return undefined
}

export function buildWheelCatalog(games: Game[] = GAMES): CatalogGame[] {
  return games
    .filter((g) => g.status === 'ready')
    .map((g) => ({
      id: g.id,
      title: g.title,
      image: g.image || '',
      players: parsePlayers(g.playersLabel),
      minutes: minutesFor(g),
      moods: moodsFor(g),
      premium: !FREE.has(g.id),
      description: (g.description || '').replace(/\n/g, ' '),
      wheelLabel: wheelLabel(g.title),
    }))
}

export function buildWebPremiumPlans(apiPlans: ApiPlan[]): PremiumPlan[] {
  const source = apiPlans.filter((p) => p.id.startsWith('premium_web_') || p.audience === 'web')
  const sorted = [...source].sort((a, b) => a.durationDays - b.durationDays)

  return sorted.map((p) => {
    const lifetime = p.durationDays >= 36500
    const days = lifetime ? null : p.durationDays
    const recommended = p.durationDays === 90
    const isMonth = p.durationDays === 30
    let badge: string | undefined
    // Subtitles under the plan title (kit reference); savings render separately in the card.
    const description = isMonth
      ? 'Для первого знакомства'
      : recommended
        ? 'Для тех, кто собирается чаще'
        : lifetime
          ? 'Для всех ваших будущих вечеров'
          : p.title
    if (recommended) badge = 'Лучший выбор'
    if (lifetime) badge = 'Максимальная выгода'
    return {
      id: p.id,
      label: lifetime ? 'Навсегда' : p.durationDays === 90 ? '90 дней' : p.durationDays === 30 ? '30 дней' : p.title,
      days,
      price: p.priceRub,
      currency: 'RUB' as const,
      description,
      recommended,
      badge,
      cta: lifetime
        ? 'Открыть навсегда'
        : recommended
          ? 'Выбрать 90 дней'
          : isMonth
            ? 'Выбрать 30 дней'
            : 'Выбрать тариф',
    }
  })
}

export function useWheelCatalog(): CatalogGame[] {
  return useMemo(() => buildWheelCatalog(), [])
}

export const WHEEL_PENDING_GAME_KEY = 'gnh_wheel_pending_game'

export function gameStartPath(gameId: string): string {
  const direct: Record<string, string> = {
    card: '/card',
    mafia: '/mafia',
    alias: '/alias',
    activity: '/activity',
    sabotage: '/sabotage',
    quiz: '/quiz',
    'truth-dare': '/truth-dare',
    'who-is-who': '/who-is-who',
    'phrase-translator': '/phrase-translator',
    'freebie-trash': '/freebie-trash',
    'russia-travel': '/russia-travel',
    sled: '/sled',
    'mafia-shadows': '/mafia-shadows',
    doubles: '/doubles',
    infected: '/infected',
  }
  return direct[gameId] || `/game/${gameId}`
}