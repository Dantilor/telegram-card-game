import { Telegraf, type Context } from 'telegraf'

console.log('[bot] module loaded')

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN

if (!BOT_TOKEN) {
  console.warn('[bot] BOT_TOKEN not set; bot will be null')
}

const START_MESSAGE = `<b>Ваш вечер начинается прямо сейчас!</b> ✨

Здесь решают эмоции, интеллект и смелость. Вы не наблюдаете — вы управляете игрой.

Соберите тех, с кем хочется разделить этот вечер
Выберите формат игры
И позвольте атмосфере сделать своё дело

<b>GameNight Host - Вы диктуете правила, мы создаем.</b>

<i>Нажмите на экран выше, чтобы убрать клавиатуру → затем откройте меню бота для запуска игры.</i>`

/** Последнее сообщение бота в /start для каждого чата — удаляется при повторном /start */
const lastStartMessageId = new Map<number | string, number>()

export const bot = BOT_TOKEN ? new Telegraf(BOT_TOKEN) : null

if (bot) {
  bot.catch((err, ctx) => {
    const update = ctx.update as { update_id?: number } | undefined
    const from = (ctx as { from?: { id?: number } }).from
    const updateKeys = update ? Object.keys(update).filter((k) => k !== 'update_id') : []

    console.error('[bot] telegraf error:', err instanceof Error ? err.message : String(err), {
      update_id: update?.update_id,
      user_id: from?.id,
      update_keys: updateKeys,
    })
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

    const sent = await ctx.reply(START_MESSAGE, {
      parse_mode: 'HTML',
      reply_markup: { remove_keyboard: true },
    })

    if (chatId && sent?.message_id) {
      lastStartMessageId.set(chatId, sent.message_id)
    }

    // Убираем кнопку меню (Web App и т.д.) в этом чате — клавиатура не появляется
    if (chatId && ctx.chat?.type === 'private') {
      try {
        await ctx.telegram.setChatMenuButton({ chatId, menuButton: { type: 'default' } })
      } catch (e) {
        console.warn('[bot] setChatMenuButton failed', e)
      }
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
    // Глобальное меню — список команд вместо Web App (меньше провокаций на появление клавиатуры)
    try {
      await bot.telegram.setChatMenuButton({ menuButton: { type: 'commands' } })
      console.log('[bot] default menu button set to commands')
    } catch (e) {
      console.warn('[bot] setChatMenuButton default failed', e)
    }
    await bot.launch()
    console.log('Bot started')
  }
}
