import { activateDocuments, deactivateDocuments, importDocuments } from './documents.js'
import { deleteExpiredAnalytics } from './cleanup.js'
import { LegalError } from './errors.js'
import { loadLegalPackage } from './packageFile.js'
import type { ParsedDocument } from './types.js'

type Args = {
  command: string
  file: string | null
  documents: string[]
  write: boolean
}

function parseArgs(argv: string[]): Args {
  const [command, ...rest] = argv
  const args: Args = { command: command ?? '', file: null, documents: [], write: false }
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index]
    if (token === '--write') args.write = true
    else if (token === '--file') args.file = rest[++index] ?? null
    else if (token === '--documents') args.documents = (rest[++index] ?? '').split(',').map((item) => item.trim()).filter(Boolean)
    else throw new LegalError('invalid_cli', 400, `unknown argument: ${token}`)
  }
  return args
}

function printPackageSummary(file: string, documents: ParsedDocument[], ignored: string[]): void {
  console.log(`file: ${file}`)
  console.log(`schema_version: 1`)
  console.log(`documents: ${documents.length}`)
  for (const document of documents) {
    console.log(`${document.id} ${document.version} sha256=${document.sha256}`)
  }
  if (ignored.length > 0) {
    console.log(`ignored activate_by_default: ${ignored.join(',')}`)
  }
}

function selectDocuments(documents: ParsedDocument[], ids: string[]): ParsedDocument[] {
  if (ids.length === 0 || ids.includes('all')) {
    throw new LegalError('invalid_cli', 400, 'pass an explicit --documents list; all documents are not activated together')
  }
  const selected: ParsedDocument[] = []
  for (const id of ids) {
    const document = documents.find((item) => item.id === id)
    if (!document) throw new LegalError('invalid_cli', 400, `${id}: not present in the package`)
    selected.push(document)
  }
  return selected
}

async function openWriter(): Promise<{
  withTransaction: typeof import('./runtime.js').withTransaction
}> {
  if (!process.env.DATABASE_URL) {
    throw new LegalError('invalid_cli', 400, 'DATABASE_URL is required for --write')
  }
  return import('./runtime.js')
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (args.command === 'import') {
    if (!args.file) throw new LegalError('invalid_cli', 400, '--file is required')
    const loaded = loadLegalPackage(args.file)
    printPackageSummary(args.file, loaded.documents, loaded.ignoredActivateByDefault)
    if (!args.write) {
      console.log('mode: dry-run')
      console.log('database: not contacted')
      return
    }
    const runtime = await openWriter()
    const summary = await importDocuments(runtime.withTransaction, loaded.documents)
    console.log(`mode: write`)
    console.log(`inserted: ${summary.inserted.join(',') || '-'}`)
    console.log(`unchanged: ${summary.unchanged.join(',') || '-'}`)
    console.log('activation: not performed')
    return
  }
  if (args.command === 'activate') {
    if (!args.file) throw new LegalError('invalid_cli', 400, '--file is required')
    const loaded = loadLegalPackage(args.file)
    const selected = selectDocuments(loaded.documents, args.documents)
    console.log(`activate: ${selected.map((document) => document.id).join(',')}`)
    for (const document of selected) console.log(`${document.id} ${document.version} sha256=${document.sha256}`)
    if (!args.write) {
      console.log('mode: dry-run')
      console.log('database: not contacted')
      return
    }
    const runtime = await openWriter()
    const summary = await activateDocuments(runtime.withTransaction, selected)
    console.log('mode: write')
    console.log(`activated: ${summary.activated.join(',') || '-'}`)
    console.log(`already_active: ${summary.alreadyActive.join(',') || '-'}`)
    return
  }
  if (args.command === 'deactivate') {
    if (args.documents.length === 0 || args.documents.includes('all')) {
      throw new LegalError('invalid_cli', 400, 'pass an explicit --documents list; documents are not deactivated together')
    }
    console.log(`deactivate: ${args.documents.join(',')}`)
    console.log('effect: active pointer only; versions, evidence, users, payments, and Premium stay')
    if (!args.write) {
      console.log('mode: dry-run')
      console.log('database: not contacted')
      return
    }
    const runtime = await openWriter()
    const summary = await deactivateDocuments(runtime.withTransaction, args.documents)
    console.log('mode: write')
    console.log(`deactivated: ${summary.deactivated.join(',') || '-'}`)
    return
  }
  if (args.command === 'cleanup-analytics') {
    console.log('retention: events older than 90 calendar days in Europe/Moscow')
    console.log('preserved: legal evidence, preferences, payments, subscriptions, users')
    if (!args.write) {
      console.log('mode: dry-run')
      console.log('database: not contacted')
      return
    }
    const runtime = await openWriter()
    const deleted = await runtime.withTransaction((queryable) => deleteExpiredAnalytics(queryable))
    console.log('mode: write')
    console.log(`deleted_events: ${deleted}`)
    return
  }
  console.log(`Usage:
  tsx src/legal/cli.ts import --file <documents.json> [--write]
  tsx src/legal/cli.ts activate --file <documents.json> --documents id1,id2 [--write]
  tsx src/legal/cli.ts deactivate --documents id1,id2 [--write]
  tsx src/legal/cli.ts cleanup-analytics [--write]

Default is dry-run and does not contact the database. --write is required to persist.
Import never activates documents. There is no public HTTP import.`)
  process.exitCode = 1
}

function publicCliError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'legal command failed'
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/(password|secret|token)=([^\s&]+)/gi, '$1=[redacted]')
}

main().catch((error: unknown) => {
  console.error(publicCliError(error))
  process.exitCode = 1
})
