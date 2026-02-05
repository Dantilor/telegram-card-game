import { Telegraf, type Context } from 'telegraf'
import { setPremium } from './memoryStore.js'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN
const WEBAPP_URL = process.env.WEBAPP_URL || ''

if (!BOT_TOKEN) {
  console.warn('BOT_TOKEN not set; bot will not start')
}

export const bot = BOT_TOKEN ? new Telegraf(BOT_TOKEN) : null

if (bot && WEBAPP_URL) {
  bot.start((ctx: Context) => {
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

  bot.on('successful_payment', async (ctx: Context) => {
    const msg = ctx.message as {
      successful_payment?: { invoice_payload?: string; total_amount?: number }
      from?: { id?: number }
    } | undefined
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
    const telegramId = payload.telegramId ?? (msg.from as { id?: number })?.id
    if (!telegramId) return

    const plan = payload.plan === 'year' ? 'year' : 'month'
    const totalAmount = msg.successful_payment?.total_amount ?? 0
    console.log(`[TCG] successful_payment: telegramId=${telegramId}, plan=${plan}, total_amount=${totalAmount}`)

    const now = Date.now()
    const premiumUntil =
      plan === 'year'
        ? now + 365 * 24 * 60 * 60 * 1000
        : now + 30 * 24 * 60 * 60 * 1000

    setPremium(telegramId, premiumUntil)
    console.log(`[TCG] set premium for ${telegramId} until ${new Date(premiumUntil).toISOString()}`)
    await ctx.reply('✅ Premium активирован')
  })
}

export async function launchBot(): Promise<void> {
  if (bot) {
    await bot.launch()
    console.log('Bot started')
  }
}
