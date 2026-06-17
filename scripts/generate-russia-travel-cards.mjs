#!/usr/bin/env node
/**
 * Merges per-deck card modules into src/data/russiaTravel.ts
 * Run: node scripts/generate-russia-travel-cards.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { CITIES_CARDS } from './russia-travel-data/cities.mjs'
import { LANDMARKS_CARDS } from './russia-travel-data/landmarks.mjs'
import { HIDDEN_RUSSIA_CARDS } from './russia-travel-data/hidden-russia.mjs'
import { TRUE_OR_MYTH_CARDS } from './russia-travel-data/true-or-myth.mjs'
import { DREAM_ROUTE_CARDS } from './russia-travel-data/dream-route.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const TARGET = join(ROOT, 'src/data/russiaTravel.ts')

const ALL = [
  ...CITIES_CARDS,
  ...LANDMARKS_CARDS,
  ...HIDDEN_RUSSIA_CARDS,
  ...TRUE_OR_MYTH_CARDS,
  ...DREAM_ROUTE_CARDS,
]

const VALID_DECKS = new Set(['cities', 'landmarks', 'hidden-russia', 'true-or-myth', 'dream-route'])
const VALID_TYPES = new Set(['guess_city', 'guess_place', 'true_or_myth', 'where_to_go'])
const VALID_DIFF = new Set(['easy', 'medium', 'hard'])

const ids = new Set()
for (const card of ALL) {
  if (ids.has(card.id)) throw new Error(`Duplicate id: ${card.id}`)
  ids.add(card.id)
  if (!VALID_DECKS.has(card.deckId)) throw new Error(`Bad deckId ${card.deckId} on ${card.id}`)
  if (!VALID_TYPES.has(card.type)) throw new Error(`Bad type ${card.type} on ${card.id}`)
  if (!VALID_DIFF.has(card.difficulty)) throw new Error(`Bad difficulty ${card.difficulty} on ${card.id}`)
}

function fmt(card) {
  const lines = [
    '  {',
    `    id: '${card.id}',`,
    `    deckId: '${card.deckId}',`,
    `    type: '${card.type}',`,
    `    difficulty: '${card.difficulty}',`,
    `    question: ${JSON.stringify(card.question)},`,
  ]
  if (card.answer != null) lines.push(`    answer: ${JSON.stringify(card.answer)},`)
  if (card.hint != null) lines.push(`    hint: ${JSON.stringify(card.hint)},`)
  if (card.fact != null) lines.push(`    fact: ${JSON.stringify(card.fact)},`)
  if (card.options != null) {
    lines.push(`    options: [${card.options.map((o) => JSON.stringify(o)).join(', ')}],`)
  }
  lines.push('  },')
  return lines.join('\n')
}

const decksMarker = 'export const RUSSIA_TRAVEL_DECKS: RussiaTravelDeck[] = ['
const helpersMarker = 'export function getRussiaTravelDeckById'
const source = readFileSync(TARGET, 'utf8')
const decksStart = source.indexOf(decksMarker)
const helpersStart = source.indexOf(helpersMarker)
if (decksStart < 0 || helpersStart < 0) throw new Error('Could not parse russiaTravel.ts structure')

let decksEnd = decksStart + decksMarker.length
let depth = 1
while (decksEnd < helpersStart && depth > 0) {
  const ch = source[decksEnd]
  if (ch === '[') depth += 1
  if (ch === ']') depth -= 1
  decksEnd += 1
}
if (depth !== 0) throw new Error('Could not find end of RUSSIA_TRAVEL_DECKS')

const prefix = source.slice(0, decksStart)
const decksBlock = source.slice(decksStart, decksEnd)
const suffix = source.slice(helpersStart)

const cardsBlock = `export const RUSSIA_TRAVEL_CARDS: RussiaTravelCard[] = [\n${ALL.map(fmt).join('\n')}\n]\n\n`

const next = prefix + decksBlock + '\n\n' + cardsBlock + suffix
writeFileSync(TARGET, next)

const counts = {}
for (const c of ALL) counts[c.deckId] = (counts[c.deckId] ?? 0) + 1
console.log(`Wrote ${ALL.length} cards to ${TARGET}`)
for (const [deck, n] of Object.entries(counts)) console.log(`  ${deck}: ${n}`)
