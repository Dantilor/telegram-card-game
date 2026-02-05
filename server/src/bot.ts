import { Telegraf, type Context } from 'telegraf'
import { setPremiumWithPersistence } from './premiumStore.js'

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
    if (!sp?.invoice_payload) return

    let payload: { plan?: string; telegramId?: number }
    try {
      payload = JSON.parse(sp.invoice_payload) as { plan?: string; telegramId?: number }
    } catch {
      return
    }
    const telegramId = payload.telegramId ?? (msg?.from as { id?: number })?.id
    if (!telegramId) return

    const plan =
      payload.plan === 'year'
        ? 'premium_year'
        : payload.plan === 'month'
          ? 'premium_6m_259'
          : payload.plan || 'premium_6m_259'

    const currency = sp.currency ?? 'XTR'
    const totalAmount = sp.total_amount ?? 0
    const providerPaymentChargeId = sp.provider_payment_charge_id ?? null
    const telegramPaymentChargeId = sp.telegram_payment_charge_id ?? null

    const saved = await setPremiumWithPersistence(telegramId, plan, {
      telegramId,
      planId: plan,
      currency,
      totalAmount,
      providerPaymentChargeId,
      telegramPaymentChargeId,
      invoicePayload: sp.invoice_payload,
      status: 'paid',
    })

    if (!saved) {
      console.log('[BOT] payment duplicate, skipped telegramId=', telegramId)
      await ctx.reply('✅ Premium уже активирован (повторная обработка пропущена)')
      return
    }

    console.log(
      `[BOT] payment saved telegramId=${telegramId} plan=${plan} premiumUntil extended`
    )
    await ctx.reply('✅ Premium активирован')
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
