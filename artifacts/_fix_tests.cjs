const fs = require('fs')
// fix audit assertion
{
  let s = fs.readFileSync('server/src/auth/webAuth.test.ts', 'utf8')
  s = s.replace(
    "assert.match(src, /getUserPremiumWithDb/)",
    "assert.match(src, /getTelegramPremium/)\n  assert.match(src, /getWebAccountPremium/)"
  )
  fs.writeFileSync('server/src/auth/webAuth.test.ts', s)
  console.log('audit fixed')
}
// fix sharedPremium subscription inserts
{
  let s = fs.readFileSync('server/src/auth/sharedPremium.test.ts', 'utf8')
  s = s.replace(
    `await harness.query.query(
      \`INSERT INTO subscriptions (telegram_id, plan_id, active_until)
       VALUES ($1, 'premium_1m', $2)
       ON CONFLICT (telegram_id) DO UPDATE SET active_until = EXCLUDED.active_until, plan_id = EXCLUDED.plan_id\`,
      [tg, until.toISOString()]
    )`,
    `await harness.query.query(
      \`INSERT INTO subscriptions (telegram_id, plan_id, active_until)
       VALUES ($1, 'premium_1m', $2)\`,
      [tg, until.toISOString()]
    )`
  )
  fs.writeFileSync('server/src/auth/sharedPremium.test.ts', s)
  console.log('insert fixed')
}
