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
  if (!checks.CONNECT) missing.push('CONNECT on database gnh_web_staging')
  if (!checks.CREATE_database) missing.push('CREATE on database gnh_web_staging')
  if (!checks.USAGE_public) missing.push('USAGE on schema public')
  if (!checks.CREATE_public) missing.push('CREATE on schema public')

  if (!input.appRoleExists) {
    missing.push(`LOGIN role ${appRole} must exist (create in Timeweb panel for staging only)`)
  }

  if (input.appRoleExists && input.appRoleMemberOfProd) {
    missing.push(
      `${appRole} is a member of ${prodRole} (report only; fix only after explicit approval — never alter gnh_supabase / gen_user / gnh_app / gamenight_bot from this tool)`
    )
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
      `CREATEROLE/role USAGE on ${appRole} is absent — OK for GRANT on objects created by the migrate user; not treated as a hard fail.`
    )
  }
  if (input.appRoleExists && !canGrantOwnedObjects) {
    notes.push(
      `Cannot yet GRANT on migrate-owned objects until CREATE on schema public is available (already listed above if missing).`
    )
  }

  return {
    checks,
    grantToAppRole: {
      onOwnedObjects: canGrantOwnedObjects,
      viaCreateRoleOrRoleUsage: canRoleAdminGrant,
    },
    missing,
    notes,
    ok: missing.length === 0,
  }
}
