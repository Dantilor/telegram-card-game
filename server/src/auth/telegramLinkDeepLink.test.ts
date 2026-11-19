import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildTelegramLinkDeepLink,
  isTelegramLinkStartParam,
  telegramBotUsername,
} from './telegramLinkDeepLink.js'

test('default bot username is GameNightHostBot', () => {
  const prev = process.env.TELEGRAM_BOT_USERNAME
  delete process.env.TELEGRAM_BOT_USERNAME
  delete process.env.BOT_USERNAME
  assert.equal(telegramBotUsername(), 'GameNightHostBot')
  if (prev != null) process.env.TELEGRAM_BOT_USERNAME = prev
})

test('deep link uses Main Mini App form without short name', () => {
  const prevShort = process.env.TELEGRAM_MINI_APP_SHORT_NAME
  delete process.env.TELEGRAM_MINI_APP_SHORT_NAME
  delete process.env.TELEGRAM_WEBAPP_SHORT_NAME
  const link = buildTelegramLinkDeepLink('wl_abcdefghijklmnopqr')
  assert.equal(link, 'https://t.me/GameNightHostBot?startapp=wl_abcdefghijklmnopqr')
  if (prevShort != null) process.env.TELEGRAM_MINI_APP_SHORT_NAME = prevShort
})

test('deep link uses Direct Link short name when configured', () => {
  const prev = process.env.TELEGRAM_MINI_APP_SHORT_NAME
  process.env.TELEGRAM_MINI_APP_SHORT_NAME = 'app'
  const link = buildTelegramLinkDeepLink('wl_abcdefghijklmnopqr')
  assert.equal(link, 'https://t.me/GameNightHostBot/app?startapp=wl_abcdefghijklmnopqr')
  if (prev == null) delete process.env.TELEGRAM_MINI_APP_SHORT_NAME
  else process.env.TELEGRAM_MINI_APP_SHORT_NAME = prev
})

test('start param validation', () => {
  assert.equal(isTelegramLinkStartParam('wl_abcdefghijklmnopqr'), true)
  assert.equal(isTelegramLinkStartParam('12345678'), false)
  assert.equal(isTelegramLinkStartParam('wl_short'), false)
})