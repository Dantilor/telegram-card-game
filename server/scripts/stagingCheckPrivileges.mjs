/**
 * Pure evaluation of staging migrate-user privilege probe results.
 * Used by apply-staging-migrations.mjs --check-connection (report only).
 */

/**
 * @param {{
 *   dbConnect: boolean,
 *   dbCreate: boolean,
 *   schemaUsage: boolean,
 *   schemaCreate: boolean,
 *   appRoleExists: boolean,
 *   appRoleMemberOfProd: boolean | null,
 *   isSuper: boolean,
 *   hasUsageOnAppRole: boolean,
 *   canCreateRole: boolean,
 *   appHasDbConnect?: boolean | null,
 *   appHasSchemaUsage?: boolean | null,
 *   migrateIsDbOwner?: boolean,
 *   migrateCanGrantDbConnect?: boolean,
 *   migrateIsSchemaOwner?: boolean,
 *   migrateCanGrantSchemaUsage?: boolean,
 *   migrationFilesReady?: boolean,
 *   missingMigrationFiles?: string[],
 *   appRole?: string,
 *   prodRole?: string,
 * }} input
 */
export function evaluateStagingCheckPrivileges(input) {
  const appRole = input.appRole || 'gnh_web_stage'
  const prodRole = input.prodRole || 'gnh_app'

  const checks = {
    CONNECT: Boolean(input.dbConnect),
    CREATE_database: Boolean(input.dbCreate),
    USAGE_public: Boolean(input.schemaUsage),
    CREATE_public: Boolean(input.schemaCreate),
  }

  const missing = []
  const actions = []
  if (!checks.CONNECT) {
    missing.push('CONNECT on database gnh_web_staging (migrate role)')
    actions.push(
      'In Timeweb panel for database gnh_web_staging only: grant CONNECT to the migrate LOGIN (gnh_web_migrate). Do not change gnh_supabase.'
    )
  }
  if (!checks.CREATE_database) {
    missing.push('CREATE on database gnh_web_staging (migrate role)')
    actions.push(
      'In Timeweb panel for gnh_web_staging only: grant CREATE on that database to gnh_web_migrate (or make it DB owner). Never alter production roles or gnh_supabase.'
    )
  }
  if (!checks.USAGE_public) {
    missing.push('USAGE on schema public (migrate role)')
    actions.push(
      'On gnh_web_staging only: grant USAGE on schema public to gnh_web_migrate.'
    )
  }
  if (!checks.CREATE_public) {
    missing.push('CREATE on schema public (migrate role)')
    actions.push(
      'On gnh_web_staging only: grant CREATE on schema public to gnh_web_migrate (or make it schema owner).'
    )
  }

  if (!input.appRoleExists) {
    missing.push(`LOGIN role ${appRole} must exist (create in Timeweb panel for staging only)`)
    actions.push(
      `Create LOGIN role ${appRole} in Timeweb for staging only (no membership in ${prodRole}, no rights on gnh_supabase).`
    )
  }

  if (input.appRoleExists && input.appRoleMemberOfProd) {
    missing.push(
      `${appRole} is a member of ${prodRole} (report only; fix only after explicit approval — never alter gnh_supabase / gen_user / gnh_app / gamenight_bot from this tool)`
    )
    actions.push(
      `Report-only: ${appRole} membership in ${prodRole} must be resolved manually after explicit approval. Do not REVOKE/ALTER from this migrate tool.`
    )
  }

  const appHasDbConnect =
    input.appHasDbConnect === undefined || input.appHasDbConnect === null
      ? null
      : Boolean(input.appHasDbConnect)
  const appHasSchemaUsage =
    input.appHasSchemaUsage === undefined || input.appHasSchemaUsage === null
      ? null
      : Boolean(input.appHasSchemaUsage)

  const migrateCanGrantDbConnect =
    Boolean(input.isSuper) ||
    Boolean(input.migrateIsDbOwner) ||
    Boolean(input.migrateCanGrantDbConnect)
  const migrateCanGrantSchemaUsage =
    Boolean(input.isSuper) ||
    Boolean(input.migrateIsSchemaOwner) ||
    Boolean(input.migrateCanGrantSchemaUsage)

  // grants-stage: GRANT CONNECT / USAGE are skipped when already present.
  let appConnectStatus = 'n/a'
  let appUsageStatus = 'n/a'
  if (input.appRoleExists) {
    if (appHasDbConnect === true) {
      appConnectStatus = 'already_present_skip_grant'
    } else if (appHasDbConnect === false) {
      appConnectStatus = migrateCanGrantDbConnect
        ? 'missing_migrate_can_grant'
        : 'missing_migrate_cannot_grant'
      if (!migrateCanGrantDbConnect) {
        missing.push(
          `${appRole} lacks CONNECT on gnh_web_staging and migrate role cannot GRANT CONNECT (not DB owner / no GRANT OPTION)`
        )
        actions.push(
          `On gnh_web_staging only (Timeweb panel): either (1) GRANT CONNECT ON DATABASE gnh_web_staging TO ${appRole}, or (2) make gnh_web_migrate the owner of database gnh_web_staging. Do not grant CREATEROLE or touch gnh_supabase.`
        )
      }
    }

    if (appHasSchemaUsage === true) {
      appUsageStatus = 'already_present_skip_grant'
    } else if (appHasSchemaUsage === false) {
      appUsageStatus = migrateCanGrantSchemaUsage
        ? 'missing_migrate_can_grant'
        : 'missing_migrate_cannot_grant'
      if (!migrateCanGrantSchemaUsage) {
        missing.push(
          `${appRole} lacks USAGE on schema public and migrate role cannot GRANT USAGE (not schema owner / no GRANT OPTION)`
        )
        actions.push(
          `On gnh_web_staging only: either (1) GRANT USAGE ON SCHEMA public TO ${appRole}, or (2) make gnh_web_migrate owner of schema public. Do not change production roles.`
        )
      }
    }
  }

  // Owner of objects created by migrate DDL can GRANT on those objects without CREATEROLE.
  const canGrantOwnedObjects =
    Boolean(input.isSuper) || Boolean(input.schemaCreate)
  // CREATEROLE / role USAGE is only needed for role-admin style grants (membership, SET ROLE), not object GRANT.
  const canRoleAdminGrant =
    Boolean(input.isSuper) ||
    Boolean(input.hasUsageOnAppRole) ||
    Boolean(input.canCreateRole)

  const notes = []
  if (input.appRoleExists && !canRoleAdminGrant) {
    notes.push(
      `CREATEROLE/role USAGE on ${appRole} is absent — OK for GRANT on objects created by the migrate user; not treated as a hard fail. Do not request CREATEROLE.`
    )
  }
  if (input.appRoleExists && !canGrantOwnedObjects) {
    notes.push(
      `Cannot yet GRANT on migrate-owned objects until CREATE on schema public is available (already listed above if missing).`
    )
  }
  if (appConnectStatus === 'already_present_skip_grant') {
    notes.push(
      `${appRole} already has CONNECT on gnh_web_staging — grants-stage will skip re-GRANT CONNECT.`
    )
  }
  if (appUsageStatus === 'already_present_skip_grant') {
    notes.push(
      `${appRole} already has USAGE on schema public — grants-stage will skip re-GRANT USAGE.`
    )
  }

  const migrationFilesReady =
    input.migrationFilesReady === undefined ? true : Boolean(input.migrationFilesReady)
  const missingMigrationFiles = Array.isArray(input.missingMigrationFiles)
    ? input.missingMigrationFiles
    : []
  if (!migrationFilesReady) {
    missing.push(
      `Migration pack incomplete (need schema + 001–015 + grants-stage). Missing: ${missingMigrationFiles.join(', ') || 'unknown'}`
    )
    actions.push(
      'Restore missing files under server/db (migrations 001–015 and staging/01_grants_gnh_web_stage.sql) on the WEB branch before Apply.'
    )
  }

  return {
    checks,
    appRoleGrants: {
      CONNECT: appHasDbConnect,
      USAGE_public: appHasSchemaUsage,
      connectStatus: appConnectStatus,
      usageStatus: appUsageStatus,
      migrateCanGrantConnect: migrateCanGrantDbConnect,
      migrateCanGrantUsage: migrateCanGrantSchemaUsage,
    },
    grantToAppRole: {
      onOwnedObjects: canGrantOwnedObjects,
      viaCreateRoleOrRoleUsage: canRoleAdminGrant,
    },
    migrationFilesReady,
    missingMigrationFiles,
    missing,
    actions,
    notes,
    ok: missing.length === 0,
  }
}
