import { Telegraf, type Context } from 'telegraf'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN
const WEBAPP_URL = process.env.WEBAPP_URL || ''

if (!BOT_TOKEN) {
  console.warn('BOT_TOKEN not set; bot will not start')
}

export const bot = BOT_TOKEN ? new Telegraf(BOT_TOKEN) : null

if (bot) {
  bot.catch((err, ctx) => {
    console.error('[bot] telegraf error:', err)
    console.error('[bot] update:', ctx.update)
  })

  bot.start(async (ctx: Context) => {
    console.log('[bot] /start from', ctx.from?.id, ctx.from?.username)
    await ctx.reply('start ok')
  })

  bot.command('ping', async (ctx: Context) => {
    console.log('[bot] /ping from', ctx.from?.id)
    await ctx.reply('pong')
  })
}

export async function launchBot(): Promise<void> {
  if (bot) {
    await bot.launch()
    console.log('Bot started')
  }
}
