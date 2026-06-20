import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.dirname(path.dirname(SCRIPT_DIR))

function parseArgs(argv) {
  const options = {
    limit: 100,
    output: 'temp1/tag-source-research/cn-100-tag-run.sample.json',
    regionBucket: 'cn',
    preferLatinName: false,
    formalIndex: 'data/formal-index/formal-index-artist-keys.json',
    qqV8Basic: 'data/platform-source/qq/v8/database/qq-v8-cn-artist-basic.json',
    qqStats: 'data/platform-source/qq/qq-artist-stats-backup.json',
    neteaseStats: 'data/platform-source/netease/netease-artist-stats-backup.json',
    qqV8Tags: 'temp1/qq-tag-previous-tables/raw-qq-snapshots/qq-v8-cn-artist-tags.json',
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--limit') options.limit = Number(argv[++i])
    else if (arg === '--output') options.output = argv[++i]
    else if (arg === '--region-bucket') options.regionBucket = argv[++i]
    else if (arg === '--prefer-latin-name') options.preferLatinName = true
    else if (arg === '--formal-index') options.formalIndex = argv[++i]
    else if (arg === '--qq-v8-basic') options.qqV8Basic = argv[++i]
    else if (arg === '--qq-stats') options.qqStats = argv[++i]
    else if (arg === '--netease-stats') options.neteaseStats = argv[++i]
    else if (arg === '--qq-v8-tags') options.qqV8Tags = argv[++i]
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return options
}

function absolute(file) {
  return path.isAbsolute(file) ? file : path.join(ROOT_DIR, file)
}

async function readJson(file) {
  return JSON.parse(await readFile(absolute(file), 'utf8'))
}

function platformId(artistKey, platform) {
  return String(artistKey || '')
    .split('|')
    .map((part) => part.split(':'))
    .find(([prefix]) => prefix === platform)?.[1] || null
}

function platformIds(artistKey) {
  return Object.fromEntries(String(artistKey || '').split('|').map((part) => part.split(':')).filter(([prefix, id]) => prefix && id))
}

function unique(values) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))]
}

function hasCjk(value) {
  return /[\u3400-\u9fff]/.test(String(value || ''))
}

function cleanLatinName(value) {
  return String(value || '')
    .replace(/\s*\([^)]*[\u3400-\u9fff][^)]*\)\s*/g, ' ')
    .replace(/\s*（[^）]*[\u3400-\u9fff][^）]*）\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function chooseName(basicArtist, qqArtist, preferLatinName) {
  const candidates = unique([
    ...(basicArtist?.all_names || []),
    basicArtist?.name,
    ...(basicArtist?.aliases || []),
    qqArtist?.name,
    ...(qqArtist?.aliases || []),
    ...(qqArtist?.name_keys || []),
  ])
  if (preferLatinName) {
    const latin = candidates
      .map(cleanLatinName)
      .find((name) => name && /[A-Za-z]/.test(name) && !hasCjk(name))
    if (latin) return latin
  }
  return basicArtist?.name || qqArtist?.name || candidates[0]
}

function buildQueryNames(primaryName, qqArtist, neteaseArtist) {
  return unique([
    primaryName,
    qqArtist?.name,
    ...(qqArtist?.aliases || []),
    ...(qqArtist?.name_keys || []),
    neteaseArtist?.name,
    ...(neteaseArtist?.aliases || []),
    ...(neteaseArtist?.name_keys || []),
  ].flatMap((name) => unique([name, cleanLatinName(name)]))).slice(0, 10)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const [formalIndex, qqV8Basic, qqStats, neteaseStats, qqV8Tags] = await Promise.all([
    readJson(options.formalIndex),
    readJson(options.qqV8Basic),
    readJson(options.qqStats),
    readJson(options.neteaseStats),
    readJson(options.qqV8Tags),
  ])

  const formalByQqId = new Map()
  for (const row of formalIndex.items || []) {
    const ids = platformIds(row.artist_key)
    if (ids.qq && !formalByQqId.has(String(ids.qq))) formalByQqId.set(String(ids.qq), row.artist_key)
  }
  const qqById = new Map((qqStats.artists || []).map((artist) => [String(artist.artist_id), artist]))
  const neteaseById = new Map((neteaseStats.artists || []).map((artist) => [String(artist.artist_id), artist]))
  const qqV8TagsById = new Map((qqV8Tags.items || []).map((artist) => [String(artist.qq_artist_id), artist]))

  const items = (qqV8Basic.artists || [])
    .filter((artist) => artist.region_bucket === options.regionBucket)
    .map((basicArtist) => {
      const qqArtistId = String(basicArtist.artist_id)
      const formalArtistKey = formalByQqId.get(qqArtistId) || `qq:${qqArtistId}`
      const neteaseArtistId = platformId(formalArtistKey, 'wy')
      const qqArtist = qqById.get(qqArtistId)
      const neteaseArtist = neteaseArtistId ? neteaseById.get(String(neteaseArtistId)) : null
      const v8Tags = qqV8TagsById.get(String(qqArtistId))
      const name = chooseName(basicArtist, qqArtist, options.preferLatinName)
      return {
        artist_key: formalArtistKey,
        name,
        query_names: buildQueryNames(name, {
          name: basicArtist.name || qqArtist?.name || v8Tags?.qq_name,
          aliases: basicArtist.aliases || qqArtist?.aliases || [],
          name_keys: basicArtist.all_names || qqArtist?.name_keys || [],
        }, neteaseArtist),
        qq_artist_id: String(qqArtistId),
        qq_artist_mid: basicArtist.artist_mid || qqArtist?.artist_mid || v8Tags?.qq_artist_mid || null,
        netease_artist_id: neteaseArtistId ? String(neteaseArtistId) : null,
        qq_readable_tags: qqArtist?.tags || [],
        qq_v8_raw_tag_ids: v8Tags?.qq_raw_tag_ids || [],
        qq_v8_context: {
          source_key: basicArtist.source_key || v8Tags?.source_key || null,
          region_bucket: basicArtist.region_bucket || null,
          type_bucket: basicArtist.type_bucket || null,
          genre_bucket: basicArtist.genre_bucket || null,
        },
        ranking_context: {
          qq_fan_count: qqArtist?.fan_count ?? null,
          qq_song_count: qqArtist?.song_count ?? null,
          netease_fan_count: neteaseArtist?.fan_count ?? null,
        },
      }
    })
    .filter(Boolean)
    .sort((a, b) => (b.ranking_context.qq_fan_count || 0) - (a.ranking_context.qq_fan_count || 0))
    .slice(0, options.limit > 0 ? options.limit : undefined)

  const output = absolute(options.output)
  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, JSON.stringify({
    generated_at: new Date().toISOString(),
    description: 'Chinese QQ v8 artists for external tag evidence runs. This is an input sample, not the final tag table.',
    selection: {
      limit: options.limit,
      sort: 'qq_fan_count desc',
      region_bucket: options.regionBucket,
      prefer_latin_name: options.preferLatinName,
      requires: ['qq v8 artist basic row matching region_bucket'],
      optional: ['formal artist_key with NetEase ID', 'local QQ stats row', 'local QQ v8 raw tag row'],
    },
    source_files: {
      formal_index: options.formalIndex,
      qq_v8_basic: options.qqV8Basic,
      qq_stats: options.qqStats,
      netease_stats: options.neteaseStats,
      qq_v8_tags: options.qqV8Tags,
    },
    stats: {
      item_count: items.length,
    },
    items,
  }, null, 2) + '\n')
  console.log(`Wrote ${items.length} artists to ${path.relative(ROOT_DIR, output)}`)
}

await main()
