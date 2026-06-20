import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.dirname(path.dirname(SCRIPT_DIR))
const PROJECT_ROOT = process.cwd()

function parseArgs(argv) {
  const options = {
    tagDir: 'tagging/data/tags',
    qqCn: 'backup/data/platform-source/qq/v8/database/qq-v8-cn-artist-basic.json',
    qqWestern: 'backup/data/platform-source/qq/v8/database/qq-v8-western-core-artist-basic.json',
    qqJapan: 'backup/data/platform-source/qq/v8/database/qq-v8-japan-artist-basic.json',
    qqKorea: 'backup/data/platform-source/qq/v8/database/qq-v8-korea-artist-basic.json',
    netease: 'backup/data/platform-source/netease/netease-artist-stats-backup.json',
    outputDir: 'platform-source/data',
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--tag-dir') options.tagDir = argv[++i]
    else if (arg === '--qq-cn') options.qqCn = argv[++i]
    else if (arg === '--qq-western') options.qqWestern = argv[++i]
    else if (arg === '--qq-japan') options.qqJapan = argv[++i]
    else if (arg === '--qq-korea') options.qqKorea = argv[++i]
    else if (arg === '--netease') options.netease = argv[++i]
    else if (arg === '--output-dir') options.outputDir = argv[++i]
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return options
}

function absolute(file) {
  return path.isAbsolute(file) ? file : path.join(PROJECT_ROOT, file)
}

async function readJson(file) {
  return JSON.parse(await readFile(absolute(file), 'utf8'))
}

async function writeJson(file, payload) {
  const target = absolute(file)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, JSON.stringify(payload, null, 2) + '\n')
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean).map((value) => String(value).trim()).filter(Boolean))]
}

function idsFromArtistKey(artistKey) {
  return Object.fromEntries(String(artistKey || '').split('|').map((part) => part.split(':')).filter(([prefix, id]) => prefix && id))
}

function compactQq(row, bucket) {
  return {
    artist_key: `qq:${row.artist_id}`,
    qq_artist_id: String(row.artist_id),
    qq_artist_mid: row.artist_mid ? String(row.artist_mid) : null,
    name: row.name || null,
    other_name: row.other_name || null,
    aliases: unique(row.aliases || []),
    all_names: unique(row.all_names || [row.name, row.other_name, ...(row.aliases || [])]),
    source_bucket: bucket,
  }
}

function compactNetease(row) {
  return {
    artist_key: `wy:${row.artist_id}`,
    netease_artist_id: String(row.artist_id),
    name: row.name || null,
    aliases: unique(row.aliases || []),
    name_keys: unique(row.name_keys || []),
  }
}

function mergeNames(...lists) {
  return unique(lists.flat().filter(Boolean))
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const tagFiles = [
    'cn-artist-light-tags.json',
    'western-artist-light-tags.json',
    'japan-artist-light-tags.json',
    'korea-artist-light-tags.json',
  ]

  const taggedRows = []
  const qqIds = new Set()
  const wyIds = new Set()
  for (const file of tagFiles) {
    const payload = await readJson(path.join(options.tagDir, file))
    for (const item of payload.items || []) {
      taggedRows.push(item)
      const ids = idsFromArtistKey(item.artist_key)
      if (ids.qq) qqIds.add(String(ids.qq))
      if (ids.wy) wyIds.add(String(ids.wy))
    }
  }

  const qqSources = [
    ['cn', options.qqCn],
    ['western', options.qqWestern],
    ['japan', options.qqJapan],
    ['korea', options.qqKorea],
  ]
  const qqById = new Map()
  for (const [bucket, file] of qqSources) {
    const payload = await readJson(file)
    for (const row of payload.artists || []) {
      const id = String(row.artist_id)
      if (qqIds.has(id) && !qqById.has(id)) qqById.set(id, compactQq(row, bucket))
    }
  }

  const neteasePayload = await readJson(options.netease)
  const neteaseById = new Map()
  for (const row of neteasePayload.artists || []) {
    const id = String(row.artist_id)
    if (wyIds.has(id) && !neteaseById.has(id)) neteaseById.set(id, compactNetease(row))
  }

  const unifiedItems = taggedRows.map((tagRow) => {
    const ids = idsFromArtistKey(tagRow.artist_key)
    const qq = ids.qq ? qqById.get(String(ids.qq)) : null
    const wy = ids.wy ? neteaseById.get(String(ids.wy)) : null
    return {
      artist_key: tagRow.artist_key,
      qq_artist_id: ids.qq || null,
      qq_artist_mid: qq?.qq_artist_mid || null,
      netease_artist_id: ids.wy || null,
      primary_name: qq?.name || wy?.name || null,
      names: mergeNames(
        [qq?.name, qq?.other_name, ...(qq?.all_names || [])],
        [wy?.name, ...(wy?.aliases || []), ...(wy?.name_keys || [])],
      ),
      qq_names: qq ? unique([qq.name, qq.other_name, ...(qq.all_names || []), ...(qq.aliases || [])]) : [],
      netease_names: wy ? unique([wy.name, ...(wy.aliases || []), ...(wy.name_keys || [])]) : [],
    }
  }).filter((row) => row.names.length > 0)

  const generatedAt = new Date().toISOString()
  const qqItems = [...qqById.values()].sort((a, b) => Number(a.qq_artist_id) - Number(b.qq_artist_id))
  const neteaseItems = [...neteaseById.values()].sort((a, b) => Number(a.netease_artist_id) - Number(b.netease_artist_id))
  const unified = {
    version: 1,
    generated_at: generatedAt,
    description: 'Compact platform name source extracted only for artists retained in formal tag tables. No stats or evidence fields are stored.',
    source_tag_dir: options.tagDir,
    stats: {
      tagged_artist_rows: taggedRows.length,
      unified_name_rows: unifiedItems.length,
      qq_name_rows: qqItems.length,
      netease_name_rows: neteaseItems.length,
      tagged_qq_ids: qqIds.size,
      tagged_netease_ids: wyIds.size,
      missing_qq_source_rows: qqIds.size - qqItems.length,
      missing_netease_source_rows: wyIds.size - neteaseItems.length,
    },
    items: unifiedItems,
  }
  const qq = {
    version: 1,
    generated_at: generatedAt,
    description: 'Compact QQ v8 name source for artists retained in formal tag tables.',
    stats: { item_count: qqItems.length },
    items: qqItems,
  }
  const netease = {
    version: 1,
    generated_at: generatedAt,
    description: 'Compact NetEase name source for artists retained in formal tag tables.',
    stats: { item_count: neteaseItems.length },
    items: neteaseItems,
  }

  await writeJson(path.join(options.outputDir, 'name-source/artist-name-source.json'), unified)
  await writeJson(path.join(options.outputDir, 'platform-source/qq-v8-artist-name-source.json'), qq)
  await writeJson(path.join(options.outputDir, 'platform-source/netease-artist-name-source.json'), netease)
  console.log(JSON.stringify(unified.stats, null, 2))
}

await main()
