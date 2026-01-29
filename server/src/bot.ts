import { Telegraf } from 'telegraf'
import { setUserPremium, getUser } from './storage.js'

const BOT_TOKEN = process.env.BOT_TOKEN
const WEBAPP_URL = process.env.WEBAPP_URL || ''

if (!BOT_TOKEN) {
  console.warn('BOT_TOKEN not set; bot will not start')
}

export const bot = BOT_TOKEN ? new Telegraf(BOT_TOKEN) : null

if (bot && WEBAPP_URL) {
  bot.start((ctx) => {
    return ctx.reply('Откройте Mini App', {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: 'Открыть Mini App',
              web_app: { url: WEBAPP_URL },
            },
          ],
        ],
      },
    })
  })

  bot.on('successful_payment', async (ctx) => {
    const msg = ctx.message
    if (!msg?.successful_payment?.invoice_payload) return
    let payload: { plan?: string; telegramId?: number }
    try {
      payload = JSON.parse(msg.successful_payment.invoice_payload) as {
        plan?: string
        telegramId?: number
      }
    } catch {
      return
    }
    const telegramId = payload.telegramId ?? msg.from?.id
    if (!telegramId) return

    const plan = payload.plan === 'year' ? 'year' : 'month'
    const now = new Date()
    const until =
      plan === 'year'
        ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
        : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    setUserPremium(telegramId, until.toISOString())
    await ctx.reply(
      plan === 'year'
        ? 'Спасибо! Premium активирован на 1 год.'
        : 'Спасибо! Premium активирован на 30 дней.'
    )
  })
}

export async function launchBot(): Promise<void> {
  if (bot) {
    await bot.launch()
    console.log('Bot started')
  }
}
