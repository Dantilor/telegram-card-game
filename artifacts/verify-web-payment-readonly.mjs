const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const EXPECT_DB = 'gnh_web_staging';
const FORBIDDEN_DB = 'gnh_supabase';
const HOST = '87c1743b41396e20e77b82cc.twc1.net';
const CA = 'C:/Users/User/Desktop/telegram-card-game/_private_legal_import/timeweb-ca.crt';

function fail(msg) {
  console.error('ABORT:', msg);
  process.exit(1);
}

async function main() {
  const password = process.env.STAGING_DB_PASSWORD;
  if (!password) fail('MISSING_PASSWORD');
  if (!fs.existsSync(CA)) fail('CA file missing: ' + CA);

  const client = new Client({
    host: HOST,
    port: 5432,
    user: process.env.STAGING_DB_USER || 'gnh_web_migrate',
    database: EXPECT_DB,
    password,
    ssl: {
      rejectUnauthorized: true,
      ca: fs.readFileSync(CA, 'utf8'),
      servername: HOST,
      minVersion: 'TLSv1.2',
    },
    connectionTimeoutMillis: 20000,
    // Defense in depth: session is read-only even before BEGIN READ ONLY.
    options: '-c default_transaction_read_only=on',
  });

  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');

    const meta = await client.query(
      `SELECT current_database() AS db, current_user AS role`
    );
    const db = meta.rows[0]?.db;
    const role = meta.rows[0]?.role;
    if (db === FORBIDDEN_DB) fail('refusing production database gnh_supabase');
    if (db !== EXPECT_DB) fail('unexpected database: ' + db);

    const tls = await client.query(
      `SELECT ssl, version AS tls FROM pg_stat_ssl WHERE pid = pg_backend_pid()`
    );
    if (!tls.rows[0]?.ssl) fail('TLS not active on connection');

    // Read-only diagnostics only. No INSERT/UPDATE/DELETE.
    const payments = await client.query(`
      SELECT id,
             web_account_id::text AS web_account_id,
             plan_id,
             amount_rub,
             currency,
             status,
             paid_at,
             premium_granted_at,
             created_at
        FROM web_payments
       ORDER BY COALESCE(paid_at, created_at) DESC NULLS LAST
       LIMIT 20`);

    const ents = await client.query(`
      SELECT id,
             web_account_id::text AS web_account_id,
             plan_id,
             source,
             payment_id,
             active_until,
             created_at,
             updated_at
        FROM web_entitlements
       ORDER BY active_until DESC NULLS LAST
       LIMIT 20`);

    const joined = await client.query(`
      SELECT p.id AS payment_id,
             p.web_account_id::text AS web_account_id,
             p.plan_id,
             p.amount_rub,
             p.currency,
             p.status,
             p.premium_granted_at,
             e.id AS entitlement_id,
             e.source,
             e.active_until
        FROM web_payments p
        LEFT JOIN web_entitlements e
          ON e.payment_id = p.id
         AND e.web_account_id = p.web_account_id
       ORDER BY COALESCE(p.premium_granted_at, p.paid_at, p.created_at) DESC NULLS LAST
       LIMIT 20`);

    const dupes = await client.query(`
      SELECT payment_id,
             COUNT(*)::int AS entitlement_rows
        FROM web_entitlements
       WHERE payment_id IS NOT NULL
       GROUP BY payment_id
      HAVING COUNT(*) > 1
       ORDER BY entitlement_rows DESC
       LIMIT 20`);

    const plans = await client.query(`
      SELECT plan_id, title, price_rub, duration_days, is_active
        FROM plans
       WHERE plan_id LIKE 'premium%'
       ORDER BY plan_id`);

    let tgRecent = { cnt: null };
    try {
      const tg = await client.query(`
        SELECT COUNT(*)::int AS cnt
          FROM payments
         WHERE COALESCE(provider,'') ILIKE '%yookassa%'
           AND created_at > now() - interval '3 days'`);
      tgRecent = tg.rows[0];
    } catch (e) {
      tgRecent = { cnt: null, note: 'payments table query skipped', error: String(e.message || e) };
    }

    const activeWeb = await client.query(`
      SELECT COUNT(*)::int AS cnt
        FROM web_entitlements
       WHERE active_until > now()`);

    const accountsWithPremium = await client.query(`
      SELECT DISTINCT web_account_id::text AS web_account_id
        FROM web_entitlements
       WHERE active_until > now()
       ORDER BY 1
       LIMIT 50`);

    const succeeded = await client.query(`
      SELECT COUNT(*)::int AS cnt
        FROM web_payments
       WHERE status = 'succeeded'
         AND premium_granted_at IS NOT NULL`);

    await client.query('COMMIT');

    const out = {
      checkedAt: new Date().toISOString(),
      meta: { db, role },
      tls: tls.rows[0],
      readOnly: true,
      payments: payments.rows,
      entitlements: ents.rows,
      joined: joined.rows,
      duplicateEntitlementsByPaymentId: dupes.rows,
      plans: plans.rows,
      telegramYookassaPaymentsLast3d: tgRecent,
      activeWebPremiumCount: activeWeb.rows[0]?.cnt ?? 0,
      succeededGrantedWebPayments: succeeded.rows[0]?.cnt ?? 0,
      accountsWithPremium: accountsWithPremium.rows,
    };

    const reportPath = path.join('artifacts', 'web-payment-verify.json');
    fs.writeFileSync(reportPath, JSON.stringify(out, null, 2));
    console.log('OK_READONLY');
    console.log(JSON.stringify({
      db: out.meta,
      tls: out.tls,
      readOnly: true,
      paymentCount: out.payments.length,
      entitlementCount: out.entitlements.length,
      activeWebPremiumCount: out.activeWebPremiumCount,
      succeededGrantedWebPayments: out.succeededGrantedWebPayments,
      duplicateEntitlementsByPaymentId: out.duplicateEntitlementsByPaymentId,
      accountsWithPremiumCount: out.accountsWithPremium.length,
      // Truncated account ids only in console summary.
      accountsWithPremiumPreview: out.accountsWithPremium.map((r) => String(r.web_account_id).slice(0, 8) + '…'),
      latestPayments: out.payments.slice(0, 5).map((p) => ({
        idPrefix: String(p.id).slice(0, 12) + '…',
        accountPrefix: String(p.web_account_id).slice(0, 8) + '…',
        plan_id: p.plan_id,
        amount_rub: p.amount_rub,
        currency: p.currency,
        status: p.status,
        paid_at: p.paid_at,
        premium_granted_at: p.premium_granted_at,
      })),
      latestEntitlements: out.entitlements.slice(0, 5).map((e) => ({
        accountPrefix: String(e.web_account_id).slice(0, 8) + '…',
        plan_id: e.plan_id,
        source: e.source,
        paymentPrefix: e.payment_id ? String(e.payment_id).slice(0, 12) + '…' : null,
        active_until: e.active_until,
      })),
      plans: out.plans,
      telegramYookassaPaymentsLast3d: out.telegramYookassaPaymentsLast3d,
      reportPath,
    }, null, 2));
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((e) => {
  console.error('ERR', e && e.message ? e.message : e);
  process.exit(1);
});
