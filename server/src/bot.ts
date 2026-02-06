import { Telegraf, type Context } from 'telegraf'
import {
  ensureUser,
  upsertSubscription,
  getActiveSubscription,
  insertStarsPaymentIfNew,
  addDays,
  PREMIUM_DAYS,
} from './services/subscriptions.js'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN
const WEBAPP_URL = process.env.WEBAPP_URL || ''

if (!BOT_TOKEN) {
  console.warn('BOT_TOKEN not set; bot will not start')
}

export const bot = BOT_TOKEN ? new Telegraf(BOT_TOKEN) : null

if (bot) {
  bot.on('pre_checkout_query', async (ctx) => {
    try {
      await ctx.answerPreCheckoutQuery(true)
      console.log('[BOT] pre_checkout ok')
    } catch (e) {
      console.error('[BOT] pre_checkout_query error:', e)
    }
  })

  bot.on('successful_payment', async (ctx: Context) => {
    const msg = ctx.message as {
      successful_payment?: {
        invoice_payload?: string
        total_amount?: number
        currency?: string
        provider_payment_charge_id?: string
        telegram_payment_charge_id?: string
      }
      from?: { id?: number }
    } | undefined
    const sp = msg?.successful_payment
    if (!sp) return

    const telegramId =
      (msg?.from as { id?: number } | undefined)?.id ??
      (() => {
        if (!sp.invoice_payload) return undefined
        try {
          const p = JSON.parse(sp.invoice_payload) as { telegramId?: number }
          return p.telegramId
        } catch {
          return undefined
        }
      })()
    if (!telegramId) return

    const telegramPaymentChargeId = sp.telegram_payment_charge_id
    if (!telegramPaymentChargeId) return

    const providerPaymentChargeId = sp.provider_payment_charge_id ?? null
    const amount = sp.total_amount ?? 0
    const currency = sp.currency ?? 'XTR'

    try {
      await ensureUser(telegramId)

      const paymentId = await insertStarsPaymentIfNew({
        telegramId,
        amount,
        currency,
        telegramPaymentChargeId,
        providerPaymentChargeId,
      })

      if (paymentId === null) {
        console.log('[BOT] payment duplicate, skipped telegramId=', telegramId)
        await ctx.reply('✅ Premium уже активирован (повторная обработка пропущена)')
        return
      }

      const now = new Date()
      const currentUntil = await getActiveSubscription(telegramId, 'premium')
      const base = currentUntil && currentUntil > now ? currentUntil : now
      const activeUntil = addDays(base, PREMIUM_DAYS)

      await upsertSubscription(telegramId, 'premium', activeUntil)

      console.log(`[BOT] payment saved telegramId=${telegramId} premiumUntil=${activeUntil.toISOString()}`)
      await ctx.reply('✅ Premium активирован')
    } catch (err) {
      console.error('[Stars] DB error', err)
      throw err
    }
  })

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
