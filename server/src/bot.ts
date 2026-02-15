import { Telegraf, type Context, Markup } from 'telegraf'

console.log('[bot] module loaded')

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN
const WEBAPP_URL = (process.env.WEBAPP_URL || '').replace(/\/+$/, '')
const PUBLIC_URL = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, '')

if (!BOT_TOKEN) {
  console.warn('[bot] BOT_TOKEN not set; bot will be null')
}
if (!PUBLIC_URL) {
  console.warn('[bot] PUBLIC_URL not set; /start will send text only (no image)')
}

const START_CAPTION = `Ваш вечер начинается здесь!

Мы приглашаем вас в игру, где эстетика встречается с азартом. Это пространство, где вы не наблюдаете — вы становитесь частью момента.

GameNight Host - Вы диктуете правила, мы создаем.`

export const bot = BOT_TOKEN ? new Telegraf(BOT_TOKEN) : null

if (bot) {
  bot.catch((err, ctx) => {
    console.error('[bot] telegraf error:', err)
    console.error('[bot] update:', ctx.update)
  })

  bot.start(async (ctx: Context) => {
    console.log('[bot] /start from', ctx.from?.id, ctx.from?.username)

    if (!WEBAPP_URL) {
      await ctx.reply('WEBAPP_URL не задан')
      return
    }

    const imageUrl = PUBLIC_URL ? `${PUBLIC_URL}/public/hero-new.png` : ''

    let imageReachable = false
    if (imageUrl) {
      try {
        const r = await fetch(imageUrl, { method: 'HEAD' })
        if (r.ok) {
          imageReachable = true
        } else {
          console.error('[bot] image not reachable', imageUrl, r.status)
        }
      } catch (e) {
        console.error('[bot] image not reachable', imageUrl, e)
      }
    }

    if (imageReachable) {
      await ctx.replyWithPhoto(imageUrl, { caption: START_CAPTION })
    } else {
      await ctx.reply(START_CAPTION)
    }

    await ctx.reply('Открыть мини-апп:', Markup.inlineKeyboard([Markup.button.webApp('🎮 Открыть GameNight Host', WEBAPP_URL)]))
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
