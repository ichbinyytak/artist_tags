import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.dirname(path.dirname(SCRIPT_DIR))

const BUCKET_FILES = {
  cn: 'data/tags/cn-artist-light-tags.json',
  western: 'data/tags/western-artist-light-tags.json',
  japan: 'data/tags/japan-artist-light-tags.json',
  korea: 'data/tags/korea-artist-light-tags.json',
}

function parseArgs(argv) {
  const options = {
    input: null,
    bucket: null,
    outputDir: 'data/tags',
    dryRun: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--input') options.input = argv[++i]
    else if (arg === '--bucket') options.bucket = argv[++i]
    else if (arg === '--output-dir') options.outputDir = argv[++i]
    else if (arg === '--dry-run') options.dryRun = true
    else throw new Error(`Unknown argument: ${arg}`)
  }
  if (!options.input) {
    throw new Error('Usage: node scripts/tags/merge-new-light-tags.mjs --input <light-tags.json> [--bucket cn|western|japan|korea] [--dry-run]')
  }
  if (options.bucket && !BUCKET_FILES[options.bucket]) throw new Error(`Unknown bucket: ${options.bucket}`)
  return options
}

function absolute(file) {
  return path.isAbsolute(file) ? file : path.join(ROOT_DIR, file)
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean).map(String))]
}

function bucketFromRegion(regionCode) {
  if (['01', '02', '03', '07'].includes(regionCode)) return 'cn'
  if (regionCode === '06') return 'western'
  if (regionCode === '04') return 'japan'
  if (regionCode === '05') return 'korea'
  return 'cn'
}

function cleanRow(row) {
  return {
    artist_key: String(row.artist_key || '').trim(),
    gender_code: row.gender_code || 'u',
    region_code: row.region_code || '07',
    language_codes: unique(row.language_codes),
    style_codes: unique(row.style_codes),
  }
}

async function readJson(file) {
  return JSON.parse(await readFile(absolute(file), 'utf8'))
}

async function writeJson(file, payload) {
  const target = absolute(file)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, JSON.stringify(payload, null, 2) + '\n')
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const input = await readJson(options.input)
  const sourceRows = Array.isArray(input) ? input : input.items || []
  const rows = sourceRows
    .map(cleanRow)
    .filter((row) => row.artist_key && row.style_codes.length > 0)

  const tables = {}
  for (const [bucket, file] of Object.entries(BUCKET_FILES)) {
    const targetFile = path.join(options.outputDir, path.basename(file))
    tables[bucket] = {
      file: targetFile,
      payload: await readJson(targetFile),
      added: 0,
      updated: 0,
      skipped: 0,
    }
  }

  for (const row of rows) {
    const bucket = options.bucket || bucketFromRegion(row.region_code)
    const table = tables[bucket]
    const existing = table.payload.items.find((item) => item.artist_key === row.artist_key)
    if (existing) {
      const before = JSON.stringify(existing)
      existing.gender_code = existing.gender_code && existing.gender_code !== 'u' ? existing.gender_code : row.gender_code
      existing.region_code = existing.region_code || row.region_code
      existing.language_codes = unique([...existing.language_codes, ...row.language_codes])
      existing.style_codes = unique([...existing.style_codes, ...row.style_codes])
      if (JSON.stringify(existing) !== before) table.updated += 1
      else table.skipped += 1
    } else {
      table.payload.items.push(row)
      table.added += 1
    }
  }

  for (const table of Object.values(tables)) {
    table.payload.stats = {
      ...(table.payload.stats || {}),
      item_count: table.payload.items.length,
      rows_with_style_codes: table.payload.items.length,
      rows_without_style_codes: 0,
      style_coverage: 1,
      updated_at: new Date().toISOString(),
    }
    if (!options.dryRun) await writeJson(table.file, table.payload)
  }

  console.log(JSON.stringify({
    dry_run: options.dryRun,
    input_rows: sourceRows.length,
    rows_with_style_codes: rows.length,
    tables: Object.fromEntries(Object.entries(tables).map(([bucket, table]) => [bucket, {
      file: table.file,
      rows: table.payload.items.length,
      added: table.added,
      updated: table.updated,
      skipped: table.skipped,
    }])),
  }, null, 2))
}

await main()
