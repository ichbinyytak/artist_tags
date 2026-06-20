import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.dirname(path.dirname(SCRIPT_DIR))
const ENDPOINT = 'https://c.y.qq.com/v8/fcg-bin/v8.fcg'

const PAGE_SIZE = Number(process.env.QQ_V8_TAG_PAGE_SIZE || 100)
const CONCURRENCY = Number(process.env.QQ_V8_TAG_CONCURRENCY || 16)
const BATCH_PAGES = Number(process.env.QQ_V8_TAG_BATCH_PAGES || 200)

const HEADERS = {
  Referer: 'https://y.qq.com/n/ryqq_v2/singer_list',
  'User-Agent': 'Mozilla/5.0',
}

function printUsage() {
  console.log([
    'Usage:',
    '  node scripts/qq/download-qq-v8-artist-tags.mjs --input <basic-json> --output <tag-json>',
    '',
    'Required:',
    '  --input         QQ v8 basic artist source json',
    '  --output        raw QQ tag snapshot json',
    '',
    'Env:',
    '  QQ_V8_TAG_PAGE_SIZE',
    '  QQ_V8_TAG_CONCURRENCY',
    '  QQ_V8_TAG_BATCH_PAGES',
    '',
    'Example:',
    '  node scripts/qq/download-qq-v8-artist-tags.mjs \\',
    '    --input data/platform-source/qq/v8/database/qq-v8-cn-artist-basic.json \\',
    '    --output temp1/qq-tag-previous-tables/raw-qq-snapshots/qq-v8-cn-artist-tags.json',
  ].join('\n'))
}

function parseArgs(argv) {
  const options = { input: null, output: null, help: false }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--help' || arg === '-h') {
      options.help = true
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
    throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

function toAbsolute(file) {
  return path.isAbsolute(file) ? file : path.join(ROOT_DIR, file)
}

function toRelative(file) {
  return path.relative(ROOT_DIR, file).replaceAll(path.sep, '/')
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'))
}

async function saveJson(file, payload) {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(payload, null, 2) + '\n')
}

async function runPool(items, worker, concurrency) {
  const results = new Array(items.length)
  let nextIndex = 0

  async function runner() {
    while (true) {
      const current = nextIndex
      nextIndex += 1
      if (current >= items.length) return
      results[current] = await worker(items[current])
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(Math.max(1, concurrency), Math.max(1, items.length)) }, () => runner()),
  )
  return results
}

async function fetchPage(key, page, attempt = 1) {
  const url = new URL(ENDPOINT)
  const params = {
    channel: 'singer',
    page: 'list',
    key,
    pagenum: String(page),
    pagesize: String(PAGE_SIZE),
    format: 'json',
    inCharset: 'utf8',
    outCharset: 'utf-8',
    notice: '0',
    platform: 'yqq',
    needNewCode: '0',
  }

  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value)
  }

  try {
    const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) })
    const json = await response.json()
    if (!response.ok || json.code !== 0) {
      throw new Error(`Bad response for ${key} page ${page}`)
    }
    return json.data
  } catch (error) {
    if (attempt >= 4) throw error
    await sleep(200 * attempt)
    return fetchPage(key, page, attempt + 1)
  }
}

function readSourceArtists(payload) {
  return Array.isArray(payload) ? payload : payload?.artists || []
}

function readSourceKeys(payload, artists) {
  const sourceKeys = payload?.source?.keys
  if (Array.isArray(sourceKeys) && sourceKeys.length) return sourceKeys
  return [...new Set(artists.map((artist) => artist.source_key).filter(Boolean))]
}

function parseTagIds(rawTag) {
  return [...new Set(
    String(rawTag || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0),
  )]
}

function buildTagItem(artist, tagIds) {
  return {
    artist_key: `qq:${String(artist.artist_id)}`,
    qq_artist_id: String(artist.artist_id),
    qq_artist_mid: String(artist.artist_mid),
    qq_name: artist.name ?? null,
    source_key: artist.source_key ?? null,
    qq_raw_tag_ids: tagIds,
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
  const sourcePayload = await readJson(inputFile)
  const sourceArtists = readSourceArtists(sourcePayload)
  const sourceKeys = readSourceKeys(sourcePayload, sourceArtists)
  const sourceMidSet = new Set(sourceArtists.map((artist) => String(artist.artist_mid)))
  const tagsByMid = new Map()
  const startedAt = Date.now()
  const bucketCounts = {}
  let rowsFetched = 0

  for (const key of sourceKeys) {
    const firstPage = await fetchPage(key, 1)
    const total = Number(firstPage.total || 0)
    const totalPage = Number(firstPage.total_page || Math.ceil(total / PAGE_SIZE))
    let bucketRowsFetched = 0
    let matchedRows = 0

    function processRows(rows) {
      rowsFetched += rows.length
      bucketRowsFetched += rows.length
      for (const row of rows) {
        const mid = String(row.Fsinger_mid || '')
        if (!sourceMidSet.has(mid)) continue
        tagsByMid.set(mid, parseTagIds(row.Fsinger_tag))
        matchedRows += 1
      }
    }

    processRows(firstPage.list || [])

    const pages = []
    for (let page = 2; page <= totalPage; page += 1) pages.push(page)
    for (let index = 0; index < pages.length; index += BATCH_PAGES) {
      const batch = pages.slice(index, index + BATCH_PAGES)
      const data = await runPool(batch, (page) => fetchPage(key, page), CONCURRENCY)
      for (const pageData of data) processRows(pageData.list || [])
    }

    bucketCounts[key] = {
      total_reported: total,
      total_page_reported: totalPage,
      rows_fetched: bucketRowsFetched,
      matched_source_artists: matchedRows,
    }
  }

  const items = sourceArtists.map((artist) => buildTagItem(artist, tagsByMid.get(String(artist.artist_mid)) || []))
  const observedTagIds = [...new Set(items.flatMap((item) => item.qq_raw_tag_ids))].sort((a, b) => a - b)
  const elapsedMs = Date.now() - startedAt
  const payload = {
    generated_at: new Date().toISOString(),
    description: `Raw QQ v8 singer tag IDs downloaded for artists in ${toRelative(inputFile)}.`,
    source_files: [toRelative(inputFile)],
    source: {
      endpoint: ENDPOINT,
      keys: sourceKeys,
      pagesize: PAGE_SIZE,
      field: 'Fsinger_tag',
    },
    stats: {
      source_artist_count: sourceArtists.length,
      matched_artist_count: tagsByMid.size,
      missing_artist_count: sourceArtists.length - tagsByMid.size,
      items_with_tag_ids: items.filter((item) => item.qq_raw_tag_ids.length > 0).length,
      observed_tag_id_count: observedTagIds.length,
      rows_fetched: rowsFetched,
      elapsed_ms: elapsedMs,
      elapsed_seconds: Number((elapsedMs / 1000).toFixed(3)),
      concurrency: CONCURRENCY,
      bucket_counts: bucketCounts,
    },
    observed_tag_ids: observedTagIds,
    items,
  }

  await saveJson(outputFile, payload)
  console.log(JSON.stringify({
    ok: true,
    input_json: inputFile,
    output_json: outputFile,
    stats: payload.stats,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
