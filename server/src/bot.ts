import { Telegraf, type Context } from 'telegraf'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN
const WEBAPP_URL = process.env.WEBAPP_URL || ''

if (!BOT_TOKEN) {
  console.warn('BOT_TOKEN not set; bot will not start')
}

export const bot = BOT_TOKEN ? new Telegraf(BOT_TOKEN) : null

if (bot) {
  if (WEBAPP_URL) {
    bot.start((ctx: Context) => {
      return ctx.reply('Откройте Mini App', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Открыть Mini App', web_app: { url: WEBAPP_URL } }],
          ],
        },
      })
    })
  }
}

export async function launchBot(): Promise<void> {
  if (bot) {
    await bot.launch()
    console.log('Bot started')
  }
}
