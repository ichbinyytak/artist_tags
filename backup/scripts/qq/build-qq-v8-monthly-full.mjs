import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.dirname(path.dirname(SCRIPT_DIR))
const MUSICU_URL = 'https://u.y.qq.com/cgi-bin/musicu.fcg'

const DETAIL_DELAY_MS = Number(process.env.QQ_V8_MONTHLY_DELAY_MS || 35)
const DETAIL_CONCURRENCY = Number(process.env.QQ_V8_MONTHLY_CONCURRENCY || 10)
const DETAIL_BATCH_SIZE = Number(process.env.QQ_V8_MONTHLY_BATCH_SIZE || 20)
const SAVE_EVERY = Number(process.env.QQ_V8_MONTHLY_SAVE_EVERY || 200)

const DEFAULT_COMM = {
  ct: 24,
  cv: 4747474,
  format: 'json',
  inCharset: 'utf-8',
  outCharset: 'utf-8',
  notice: 0,
  platform: 'yqq.json',
  needNewCode: 1,
}

function printUsage() {
  console.log([
    'Usage:',
    '  node scripts/qq/build-qq-v8-monthly-full.mjs --input <source-json> --output <monthly-json> [options]',
    '',
    'Required:',
    '  --input         QQ v8 basic source json',
    '  --output        monthly output json',
    '',
    'Optional:',
    '  --progress      progress json, default: <output>.progress.json',
    '  --description   custom description text',
    '  --start-index   pending start index, default: 0',
    '  --limit         pending fetch limit, default: all',
    '  --force-refetch force all rows to refetch, default: false',
    '',
    'Env:',
    '  QQ_V8_MONTHLY_DELAY_MS',
    '  QQ_V8_MONTHLY_CONCURRENCY',
    '  QQ_V8_MONTHLY_BATCH_SIZE',
    '  QQ_V8_MONTHLY_SAVE_EVERY',
    '',
    'Examples:',
    '  node scripts/qq/build-qq-v8-monthly-full.mjs \\',
    '    --input data/platform-source/qq/v8/database/qq-v8-western-core-artist-basic.json \\',
    '    --output data/monthly/qq/qq-v8-western-core-monthly.json \\',
    '    --force-refetch',
    '',
    '  node scripts/qq/build-qq-v8-monthly-full.mjs \\',
    '    --input data/platform-source/qq/v8/database/qq-v8-korea-artist-basic.json \\',
    '    --output data/monthly/qq/qq-v8-korea-monthly.json \\',
    '    --force-refetch',
  ].join('\n'))
}

function parseArgs(argv) {
  const options = {
    input: null,
    output: null,
    progress: null,
    description: null,
    startIndex: 0,
    limit: 0,
    forceRefetch: false,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--help' || arg === '-h') {
      options.help = true
      continue
    }
    if (arg === '--force-refetch') {
      options.forceRefetch = true
      continue
    }
    if (arg === '--input') {
      options.input = argv[index + 1] || null
      index += 1
      continue
    }
    if (arg === '--output') {
      options.output = argv[index + 1] || null
      index += 1
      continue
    }
    if (arg === '--progress') {
      options.progress = argv[index + 1] || null
      index += 1
      continue
    }
    if (arg === '--description') {
      options.description = argv[index + 1] || null
      index += 1
      continue
    }
    if (arg === '--start-index') {
      options.startIndex = Number(argv[index + 1] || 0)
      index += 1
      continue
    }
    if (arg === '--limit') {
      options.limit = Number(argv[index + 1] || 0)
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

function toAbsolute(file) {
  if (!file) return null
  return path.isAbsolute(file) ? file : path.join(ROOT_DIR, file)
}

function toRelative(file) {
  return path.relative(ROOT_DIR, file).replaceAll(path.sep, '/')
}

function defaultProgressFile(outputFile) {
  if (outputFile.endsWith('.json')) {
    return outputFile.replace(/\.json$/u, '.progress.json')
  }
  return `${outputFile}.progress.json`
}

function defaultDescription(inputFile) {
  return `QQ monthly table built by full QQ detail fetch from ${toRelative(inputFile)}.`
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fileExists(file) {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'))
}

async function saveJson(file, payload) {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(payload, null, 2) + '\n')
}

function chunk(values, size) {
  const result = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

async function runPool(items, worker, concurrency) {
  const results = new Array(items.length)
  let nextIndex = 0

  async function runner() {
    while (true) {
      const current = nextIndex
      nextIndex += 1
      if (current >= items.length) return
      results[current] = await worker(items[current], current)
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, () => runner())
  await Promise.all(workers)
  return results
}

async function musicuRequest(requests) {
  const response = await fetch(MUSICU_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://y.qq.com',
      Referer: 'https://y.qq.com/',
      'User-Agent': 'Mozilla/5.0',
    },
    body: JSON.stringify({
      comm: DEFAULT_COMM,
      ...requests,
    }),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${MUSICU_URL}`)
  }

  return response.json()
}

async function fetchSingerDetailsBatch(items) {
  const requests = {}

  items.forEach((item, index) => {
    requests[`req_${index}`] = {
      module: 'music.web_singer_info_svr',
      method: 'get_singer_detail_info',
      param: {
        singermid: item.qq_artist_mid,
      },
    }
  })

  const json = await musicuRequest(requests)

  return items.map((item, index) => ({
    item,
    data: json?.[`req_${index}`]?.data || null,
  }))
}

function readSourceArtists(payload) {
  return Array.isArray(payload) ? payload : payload?.artists || []
}

function sortMonthlyItems(items) {
  return [...items].sort((a, b) => {
    const aSong = a.song_count ?? -1
    const bSong = b.song_count ?? -1
    if (bSong !== aSong) return bSong - aSong

    const aAlbum = a.album_count ?? -1
    const bAlbum = b.album_count ?? -1
    if (bAlbum !== aAlbum) return bAlbum - aAlbum

    return String(a.qq_artist_id).localeCompare(String(b.qq_artist_id))
  })
}

function buildMonthlyItem(sourceArtist, previousItem) {
  const artistId = String(sourceArtist.artist_id)
  const artistMid = String(sourceArtist.artist_mid)

  return {
    artist_key: `qq:${artistId}`,
    qq_artist_id: artistId,
    qq_artist_mid: artistMid,
    qq_name: sourceArtist.name ?? null,
    qq_other_name: sourceArtist.other_name ?? null,
    aliases: Array.isArray(sourceArtist.aliases) ? sourceArtist.aliases : [],
    all_names: Array.isArray(sourceArtist.all_names) ? sourceArtist.all_names : [],
    source_key: sourceArtist.source_key ?? null,
    region_bucket: sourceArtist.region_bucket ?? null,
    type_bucket: sourceArtist.type_bucket ?? null,
    genre_bucket: sourceArtist.genre_bucket ?? null,
    song_count: previousItem?.song_count ?? null,
    album_count: previousItem?.album_count ?? null,
    fan_count: previousItem?.fan_count ?? null,
    updated_at: previousItem?.updated_at ?? null,
    qq_link: `https://y.qq.com/n/ryqq_v2/singer/${artistMid}`,
  }
}

function buildOutput({ generatedAt, description, inputFile, sourceStats, items, progressStats }) {
  const withSongCount = items.filter((item) => item.song_count !== null).length
  const withAlbumCount = items.filter((item) => item.album_count !== null).length
  const withFanCount = items.filter((item) => item.fan_count !== null).length

  return {
    generated_at: generatedAt,
    description,
    source_files: [toRelative(inputFile)],
    stats: {
      source_artist_count: items.length,
      items_with_song_count: withSongCount,
      items_with_album_count: withAlbumCount,
      items_with_fan_count: withFanCount,
      items_missing_song_count: items.length - withSongCount,
      detail_fetch_count: progressStats.detail_fetch_count,
      detail_reused_count: progressStats.detail_reused_count,
      detail_error_count: progressStats.detail_error_count,
      detail_batch_count: progressStats.detail_batch_count,
      sorted_by: 'song_count_desc',
      source_snapshot_generated_at: sourceStats?.generated_at ?? null,
      source_snapshot_artist_count: sourceStats?.artist_count ?? null,
    },
    items: sortMonthlyItems(items),
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printUsage()
    return
  }

  if (!options.input || !options.output) {
    printUsage()
    throw new Error('Missing required --input or --output')
  }

  const inputFile = toAbsolute(options.input)
  const outputFile = toAbsolute(options.output)
  const progressFile = toAbsolute(options.progress || defaultProgressFile(outputFile))
  const description = options.description || defaultDescription(inputFile)

  const sourcePayload = await readJson(inputFile)
  const sourceArtists = readSourceArtists(sourcePayload)

  const previousPayload = (await fileExists(progressFile)) ? await readJson(progressFile) : null
  const previousItems = Array.isArray(previousPayload?.items) ? previousPayload.items : []
  const previousByArtistId = new Map(previousItems.map((item) => [String(item.qq_artist_id), item]))

  const monthlyItems = sourceArtists.map((artist) => buildMonthlyItem(artist, previousByArtistId.get(String(artist.artist_id))))
  const monthlyByArtistId = new Map(monthlyItems.map((item) => [String(item.qq_artist_id), item]))

  const progressStats = {
    detail_fetch_count: 0,
    detail_reused_count: 0,
    detail_error_count: 0,
    detail_batch_count: 0,
  }

  const pendingItems = monthlyItems.filter((item) => {
    if (options.forceRefetch) return true
    if (item.song_count === null) return true
    if (item.album_count === null) return true
    if (item.fan_count === null) return true
    return false
  })

  const pendingWindow = options.limit > 0
    ? pendingItems.slice(options.startIndex, options.startIndex + options.limit)
    : pendingItems.slice(options.startIndex)

  progressStats.detail_reused_count = monthlyItems.length - pendingWindow.length

  async function saveSnapshot() {
    const payload = buildOutput({
      generatedAt: new Date().toISOString(),
      description,
      inputFile,
      sourceStats: sourcePayload?.stats || null,
      items: [...monthlyByArtistId.values()],
      progressStats,
    })
    await saveJson(progressFile, payload)
  }

  await saveSnapshot()

  const pendingBatches = chunk(pendingWindow, DETAIL_BATCH_SIZE)

  await runPool(
    pendingBatches,
    async (batch, batchIndex) => {
      try {
        await sleep(DETAIL_DELAY_MS)
        const results = await fetchSingerDetailsBatch(batch)
        progressStats.detail_fetch_count += results.length
        progressStats.detail_batch_count += 1

        for (const result of results) {
          const item = monthlyByArtistId.get(String(result.item.qq_artist_id))
          if (!item) continue
          const data = result.data
          item.song_count = data?.total_song ?? item.song_count ?? null
          item.album_count = data?.total_album ?? item.album_count ?? null
          item.fan_count = data?.singer_info?.fans ?? item.fan_count ?? null
          item.updated_at = new Date().toISOString()
        }
      } catch {
        progressStats.detail_error_count += batch.length
      }

      if ((batchIndex + 1) % Math.max(1, Math.ceil(SAVE_EVERY / DETAIL_BATCH_SIZE)) === 0) {
        await saveSnapshot()
      }
    },
    DETAIL_CONCURRENCY,
  )

  const finalPayload = buildOutput({
    generatedAt: new Date().toISOString(),
    description,
    inputFile,
    sourceStats: sourcePayload?.stats || null,
    items: [...monthlyByArtistId.values()],
    progressStats,
  })

  await saveJson(progressFile, finalPayload)
  await saveJson(outputFile, finalPayload)

  console.log(JSON.stringify({
    ok: true,
    input_json: inputFile,
    output_json: outputFile,
    progress_json: progressFile,
    stats: finalPayload.stats,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
