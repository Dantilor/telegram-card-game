import { Telegraf, type Context } from 'telegraf'

console.log('[bot] module loaded')

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN
const PUBLIC_URL = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, '')
const IMAGE_URL = PUBLIC_URL ? `${PUBLIC_URL}/public/hero-new.png` : ''

if (!BOT_TOKEN) {
  console.warn('[bot] BOT_TOKEN not set; bot will be null')
}
if (!PUBLIC_URL) {
  console.warn('[bot] PUBLIC_URL not set; /start will send text only (no image)')
}

const START_CAPTION = `Ваш вечер начинается здесь!

Мы приглашаем вас в игру, где эстетика встречается с азартом. Это пространство, где вы не наблюдаете — вы становитесь частью момента.

<b>GameNight Host - Вы диктуете правила, мы создаем.</b>`

const WEBAPP_URL = process.env.WEBAPP_URL || 'https://telegram-card-game.onrender.com'

const START_REPLY_MARKUP = {
  inline_keyboard: [
    [{ text: 'Стать частью игры', web_app: { url: WEBAPP_URL } }],
  ],
}

/** Последнее сообщение бота в /start для каждого чата — удаляется при повторном /start */
const lastStartMessageId = new Map<number | string, number>()

export const bot = BOT_TOKEN ? new Telegraf(BOT_TOKEN) : null

if (bot) {
  bot.catch((err, ctx) => {
    console.error('[bot] telegraf error:', err)
    console.error('[bot] update:', ctx.update)
  })

  bot.start(async (ctx: Context) => {
    console.log('[bot] /start from', ctx.from?.id, ctx.from?.username)

    const chatId = ctx.chat?.id
    if (chatId && lastStartMessageId.has(chatId)) {
      try {
        await ctx.telegram.deleteMessage(chatId, lastStartMessageId.get(chatId)!)
      } catch {
        // сообщение слишком старое или уже удалено — игнорируем
      }
      lastStartMessageId.delete(chatId)
    }

    let sent: { message_id: number } | undefined
    if (IMAGE_URL) {
      try {
        const resp = await fetch(IMAGE_URL)
        const contentType = resp.headers.get('content-type') || ''
        console.log('[bot] image fetch', resp.status, contentType)

        if (resp.ok && contentType.startsWith('image/')) {
          const arrayBuffer = await resp.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)
          console.log('[bot] image size', buffer.length)

          sent = await ctx.replyWithPhoto(
            { source: buffer },
            { caption: START_CAPTION, parse_mode: 'HTML', reply_markup: START_REPLY_MARKUP }
          )
        }
      } catch (e) {
        console.error('[bot] image fetch error', e)
      }
    }

    if (!sent) {
      sent = await ctx.reply(START_CAPTION, { parse_mode: 'HTML', reply_markup: START_REPLY_MARKUP })
    }

    if (chatId && sent?.message_id) {
      lastStartMessageId.set(chatId, sent.message_id)
    }
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
