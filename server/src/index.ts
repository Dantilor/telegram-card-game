import 'dotenv/config'
import express from 'express'
import { launchBot } from './bot.js'
import api from './api.js'

const PORT = parseInt(process.env.PORT || '3000', 10)

const app = express()
app.use(express.json())
app.use('/api', api)

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

async function main() {
  await launchBot()
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`)
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
