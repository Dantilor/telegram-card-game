# Party games × WEB session (Stage 2B analysis)

## Already playable in browser without Telegram SDK

Local / client-only games reuse the same routes and work after WEB login:

- Card decks / Play
- Alias, Activity
- Mafia (local), Sabotage
- Quiz, Truth or Dare
- Who is Who, Phrase Translator
- Freebie Trash, Russia Travel
- Comics

Haptic / BackButton / openLink already degrade to browser fallbacks (`navigator.vibrate`, in-app BackButton, `window.open`).

## Server rooms (Premium host + free guests)

| Game | Host Premium check today | Guest join | WEB session gap |
|---|---|---|---|
| Sled | `x-telegram-init-data` → `verifyInitData` | code + participant token | Host needs dual-auth (`resolveAuth`) on create/start |
| Mafia Shadows | same | code + token | same |
| Doubles | same | code + token | same |
| Infected | same | code + token | same |

Guest flow by room code does **not** require Telegram identity and should keep working in WEB.

## Stage 2B decision

- Do **not** change production party route auth in this stage.
- Next stage: apply `resolveAuth` / `requireAnyAuth` to host-only actions (`POST /rooms`, start game) while leaving guest join unchanged.
- Invite URLs for WEB should use BrowserRouter paths (`/infected?room=…`) instead of hash URLs when the shell is WEB.
