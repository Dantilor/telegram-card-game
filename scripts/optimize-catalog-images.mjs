#!/usr/bin/env node
/**
 * Generates compressed WebP/AVIF copies of catalog covers and Home thumbnails.
 * Originals stay untouched; in-game artwork is not processed.
 * Run: node scripts/optimize-catalog-images.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const assets = path.join(root, 'src', 'assets')
const outDir = path.join(assets, 'optimized')

const CATALOG = {
  'card_game_hero.png': 'catalog-card-game',
  'mafia_game.png': 'catalog-mafia',
  'activity_game.png': 'catalog-activity',
  'sabotage_game.png': 'catalog-sabotage',
  'alias_game.png': 'catalog-alias',
  'quiz_game.png': 'catalog-quiz',
  'truth_dare_game.png': 'catalog-truth-dare',
  '../games/who-is-who/assets/who-is-who-card.png': 'catalog-who-is-who',
  'phrase_translator_game.png': 'catalog-phrase-translator',
  'freebie_trash_game.png': 'catalog-freebie-trash',
  'russia_travel_game.png': 'catalog-russia-travel',
  'sled_cover.jpg': 'catalog-sled',
  'mafia_shadows_hero.png': 'catalog-mafia-shadows',
  'dvoiniki_keyart.webp': 'catalog-doubles',
  'infected_cover.png': 'catalog-infected',
}

const HOME_HEROES = {
  'home/neon/hero-portal.png': 'home-hero-neon',
  'home/light-pixel/light_hero_exact.png': 'home-hero-light',
  'home/sunset/hero-sunset.png': 'home-hero-sunset',
  'home/calm/hero-calm.png': 'home-hero-calm',
}

const PREMIUM_GEMS = {
  'icons/gnh-light-pro/premium-diamond-pro.png': 'premium-gem-neon',
  'icons/gnh-calm-pro/premium-diamond-pro.png': 'premium-gem-light',
  'icons/gnh-sunset-pro/premium-diamond-pro.png': 'premium-gem-sunset',
  'icons/gnh/premium-diamond.png': 'premium-gem-calm',
}

const HOME_PICKS = {
  'mafia_shadows_hero.png': 'home-pick-mafia-shadows',
  'dvoiniki_keyart.webp': 'home-pick-doubles',
  'infected_cover.png': 'home-pick-infected',
}

// Catalog hero cards span the phone width (~390 CSS px at DPR 3).
const CATALOG_WIDTH = 1080
// Home hero art keeps its source size (1024 px); only the encoding changes.
const HERO_WIDTH = 1024
// Home pick thumbnails are ~86 CSS px wide; 320 px covers DPR 3 with cropping headroom.
const PICK_WIDTH = 320
// Premium gem is drawn at most ~86 CSS px wide (Home banner); WebP keeps the alpha channel.
const GEM_WIDTH = 288

fs.mkdirSync(outDir, { recursive: true })

async function write(src, name, width, formats) {
  const input = path.join(assets, src)
  const meta = await sharp(input).metadata()
  const targetWidth = Math.min(width, meta.width ?? width)
  const rows = []
  for (const format of formats) {
    const file = path.join(outDir, `${name}.${format}`)
    const pipeline = sharp(input).resize({ width: targetWidth, withoutEnlargement: true })
    if (format === 'webp') await pipeline.webp({ quality: width === HERO_WIDTH ? 80 : 78, effort: 6 }).toFile(file)
    else await pipeline.avif({ quality: 52, effort: 6 }).toFile(file)
    rows.push(`${path.basename(file)} ${Math.round(fs.statSync(file).size / 1024)}KB`)
  }
  console.log(`${src} (${Math.round(fs.statSync(input).size / 1024)}KB) -> ${rows.join(', ')}`)
}

for (const [src, name] of Object.entries(CATALOG)) await write(src, name, CATALOG_WIDTH, ['webp'])
for (const [src, name] of Object.entries(HOME_HEROES)) await write(src, name, HERO_WIDTH, ['webp'])
for (const [src, name] of Object.entries(HOME_PICKS)) await write(src, name, PICK_WIDTH, ['webp', 'avif'])
for (const [src, name] of Object.entries(PREMIUM_GEMS)) await write(src, name, GEM_WIDTH, ['webp'])
