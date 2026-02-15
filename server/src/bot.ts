import { Telegraf, type Context } from 'telegraf'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN
const WEBAPP_URL = process.env.WEBAPP_URL || ''

if (!BOT_TOKEN) {
  console.warn('BOT_TOKEN not set; bot will not start')
}

export const bot = BOT_TOKEN ? new Telegraf(BOT_TOKEN) : null

if (bot) {
  bot.catch((err, ctx) => {
    console.error('[bot] telegraf error', err, 'update', ctx.update)
  })

  bot.command('start', (ctx: Context) => {
    console.log('[bot] /start received', ctx.from?.id)
    // Временно только текст — проверка, что ответы уходят
    // if (WEBAPP_URL) { ctx.reply('Откройте Mini App', { reply_markup: ... }) }
    return ctx.reply('start ok')
  })

  bot.command('ping', (ctx: Context) => {
    console.log('[bot] /ping received', ctx.from?.id)
    return ctx.reply('pong')
  })
}

export async function launchBot(): Promise<void> {
  if (bot) {
    await bot.launch()
    console.log('Bot started')
  }
}
