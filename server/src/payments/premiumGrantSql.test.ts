import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  ENSURE_YOOKASSA_PAYMENT_SQL,
  INSERT_CHECKOUT_PAYMENT_SQL,
} from './premiumGrantSql.js'

const here = path.dirname(fileURLToPath(import.meta.url))

describe('premiumGrantSql production payments compatibility', () => {
  it('INSERT_CHECKOUT_PAYMENT_SQL matches ac49d0c shape without provider column', () => {
    assert.doesNotMatch(INSERT_CHECKOUT_PAYMENT_SQL, /\bprovider\b/)
    assert.match(INSERT_CHECKOUT_PAYMENT_SQL, /telegram_id,\s*plan_id,\s*currency,\s*total_amount/)
    assert.match(INSERT_CHECKOUT_PAYMENT_SQL, /provider_payment_charge_id,\s*status/)
    assert.match(INSERT_CHECKOUT_PAYMENT_SQL, /offer_evidence_id,\s*receipt_contact,\s*receipt_contact_kind/)
    assert.match(
      INSERT_CHECKOUT_PAYMENT_SQL,
      /VALUES \(\$1::bigint,\s*\$2,\s*'RUB',\s*\$3,\s*\$4,\s*'pending',\s*\$5,\s*\$6,\s*\$7\)/
    )
  })

  it('ENSURE_YOOKASSA_PAYMENT_SQL recovery insert also omits provider', () => {
    assert.doesNotMatch(ENSURE_YOOKASSA_PAYMENT_SQL, /\bprovider\b(?!_payment_charge_id)/)
    assert.match(ENSURE_YOOKASSA_PAYMENT_SQL, /telegram_id,\s*plan_id,\s*currency,\s*total_amount/)
  })

  it('Telegram create path inserts checkout row after provider call; mock path reaches confirmationUrl', () => {
    const route = fs.readFileSync(path.join(here, '../routes/yookassa.ts'), 'utf8')
    assert.match(route, /async function handleCreatePayment/)
    assert.match(route, /json\(\{\s*confirmationUrl,\s*paymentId,\s*mock:\s*true\s*\}\)/)
    assert.match(route, /json\(\{\s*confirmationUrl,\s*paymentId:\s*payment\.id\s*\}\)/)

    const telegramMockBlock = route.indexOf('yookassaMockEnabled()')
    assert.ok(telegramMockBlock >= 0)
    // Prefer the Mini App (non-webAccount) mock block: insert then confirmationUrl response.
    const mockInsert = route.indexOf('await query(INSERT_CHECKOUT_PAYMENT_SQL', telegramMockBlock)
    const mockUrl = route.indexOf('confirmationUrl, paymentId, mock: true', mockInsert)
    assert.ok(mockInsert >= 0 && mockUrl > mockInsert)

    const liveFetch = route.indexOf("fetch('https://api.yookassa.ru/v3/payments'", mockUrl)
    const liveInsert = route.indexOf('await query(INSERT_CHECKOUT_PAYMENT_SQL', liveFetch)
    const liveRespond = route.indexOf('confirmationUrl, paymentId: payment.id', liveInsert)
    assert.ok(liveFetch >= 0 && liveInsert > liveFetch && liveRespond > liveInsert)
    // Live order: YooKassa first, then DB. Failed INSERT can leave a provider pending without a local row;
    // ENSURE_YOOKASSA_PAYMENT_SQL recovers on webhook (no automatic charge/confirm here).
    assert.match(route, /ENSURE_YOOKASSA_PAYMENT_SQL/)
  })
})