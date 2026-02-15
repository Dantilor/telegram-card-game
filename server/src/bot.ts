import { Telegraf, type Context } from 'telegraf'

console.log('[bot] module loaded')

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN
if (!BOT_TOKEN) {
  console.warn('[bot] BOT_TOKEN not set; bot will be null')
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

  console.log('[bot] handlers registered (start, ping)')
} else {
  console.log('[bot] bot is null (no BOT_TOKEN), handlers skipped')
}

export async function launchBot(): Promise<void> {
  if (bot) {
    await bot.launch()
    console.log('Bot started')
  }
}
