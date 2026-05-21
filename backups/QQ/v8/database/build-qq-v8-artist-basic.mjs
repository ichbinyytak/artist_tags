import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const ENDPOINT = 'https://c.y.qq.com/v8/fcg-bin/v8.fcg'
const PAGE_SIZE = Number(process.env.QQ_V8_PAGE_SIZE || 100)
const CONCURRENCY = Number(process.env.QQ_V8_CONCURRENCY || 12)
const BATCH_PAGES = Number(process.env.QQ_V8_BATCH_PAGES || 120)
const OUTPUT_SCHEMA = process.env.QQ_V8_OUTPUT_SCHEMA || 'basic'

const TARGETS = {
  cn: {
    output: 'qq-v8-cn-artist-basic.json',
    keys: ['cn_man_all', 'cn_woman_all', 'cn_team_all'],
  },
  japan: {
    output: 'qq-v8-japan-artist-basic.json',
    keys: ['j_man_all', 'j_woman_all', 'j_team_all'],
  },
  korea: {
    output: 'qq-v8-korea-artist-basic.json',
    keys: ['k_man_all', 'k_woman_all', 'k_team_all'],
  },
  western_raw: {
    output: 'qq-v8-western-artist-basic.json',
    keys: ['eu_man_all', 'eu_woman_all', 'eu_team_all'],
  },
  western_core: {
    output: 'qq-v8-western-core-artist-basic.json',
    keys: ['eu_man_all', 'eu_woman_all', 'eu_team_all'],
    filter: (row) => keepWestern(row, 30000),
  },
  western_extended: {
    output: 'qq-v8-western-extended-artist-basic.json',
    keys: ['eu_man_all', 'eu_woman_all', 'eu_team_all'],
    filter: (row) => keepWestern(row, 50000),
  },
}

const HEADERS = {
  Referer: 'https://y.qq.com/n/ryqq_v2/singer_list',
  'User-Agent': 'Mozilla/5.0',
}

function usage() {
  const names = Object.keys(TARGETS).join('|')
  console.log(`Usage: node build-qq-v8-artist-basic.mjs <${names}|all-confirmed>`)
  console.log('')
  console.log('Examples:')
  console.log('  node build-qq-v8-artist-basic.mjs cn')
  console.log('  node build-qq-v8-artist-basic.mjs all-confirmed')
  console.log('  node build-qq-v8-artist-basic.mjs western_core')
}

function unique(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
}

function splitNames(value) {
  if (!value) return []
  return String(value)
    .split(/[,/|;；、]/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function extractParenNames(name) {
  const value = String(name || '').trim()
  const names = []
  const matches = value.matchAll(/[（(]([^()（）]+)[）)]/g)
  for (const match of matches) {
    const inner = String(match[1] || '').trim()
    if (inner) names.push(inner)
  }

  const base = value.replace(/\s*[（(][^()（）]+[）)]\s*/g, ' ').replace(/\s+/g, ' ').trim()
  if (base && base !== value) names.unshift(base)
  return names
}

function hasHan(value) {
  return /[\u3400-\u9fff]/.test(String(value || ''))
}

function keepWestern(row, sortLimit) {
  const otherName = String(row.Fother_name || '').trim()
  const tag = String(row.Fsinger_tag || '').trim()
  const sortRank = Number(row.Fsort)
  return Boolean(
    otherName ||
      tag ||
      hasHan(`${row.Fsinger_name || ''} ${otherName}`) ||
      (Number.isFinite(sortRank) && sortRank <= sortLimit),
  )
}

function parseKey(key) {
  const [region, type, genre] = key.split('_')
  return { region_bucket: region, type_bucket: type, genre_bucket: genre }
}

function buildArtist(row, sourceKey) {
  const artistId = Number(row.Fsinger_id)
  const name = String(row.Fsinger_name || '').trim()
  const aliases = unique([
    ...splitNames(row.Fother_name),
    ...extractParenNames(name),
  ]).filter((alias) => alias !== name)

  const sortRank = Number(row.Fsort)
  const trend = Number(row.Ftrend)

  const basicArtist = {
    artist_id: Number.isFinite(artistId) ? artistId : row.Fsinger_id,
    artist_mid: row.Fsinger_mid,
    name,
    other_name: String(row.Fother_name || '').trim(),
    aliases,
    all_names: unique([name, row.Fother_name, ...aliases]),
    source_key: sourceKey,
    ...parseKey(sourceKey),
  }

  if (OUTPUT_SCHEMA === 'basic') return basicArtist

  return {
    ...basicArtist,
    tag_ids: unique(String(row.Fsinger_tag || '').split(',')),
    sort_rank: Number.isFinite(sortRank) ? sortRank : null,
    trend: Number.isFinite(trend) ? trend : null,
    area_code: row.Farea,
    type_code: row.Ftype,
    genre_code: row.Fgenre,
    index: row.Findex,
    attribute_3: row.Fattribute_3,
    attribute_4: row.Fattribute_4,
    voc: row.voc,
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
    const response = await fetch(url, { headers: HEADERS })
    const text = await response.text()
    if (!text.trim()) throw new Error(`empty response ${key} page ${page}`)
    const json = JSON.parse(text)
    if (json.code !== 0) throw new Error(`bad code ${key} page ${page}: ${json.code}`)
    return json.data
  } catch (error) {
    if (attempt >= 4) throw error
    await sleep(200 * attempt)
    return fetchPage(key, page, attempt + 1)
  }
}

async function runPool(items, worker, concurrency) {
  const results = new Array(items.length)
  let next = 0

  async function runner() {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await worker(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(items.length, 1)) }, runner))
  return results
}

function writeJsonValue(stream, value, firstRef) {
  if (!firstRef.value) stream.write(',\n')
  firstRef.value = false
  stream.write(JSON.stringify(value, null, 2).replace(/^/gm, '    '))
}

async function buildTarget(targetName) {
  const target = TARGETS[targetName]
  if (!target) throw new Error(`Unknown target: ${targetName}`)

  const started = Date.now()
  const output = path.join(SCRIPT_DIR, target.output)
  const tmp = `${output}.tmp`
  const stream = fs.createWriteStream(tmp, { encoding: 'utf8' })
  const seen = new Set()
  const firstArtist = { value: true }
  const bucketCounts = {}
  let rowsFetched = 0
  let artistCount = 0
  let duplicateRows = 0
  let filteredRows = 0

  stream.write('{\n')
  stream.write(`  "generated_at": ${JSON.stringify(new Date().toISOString())},\n`)
  stream.write(`  "source": ${JSON.stringify({ endpoint: ENDPOINT, keys: target.keys, pagesize: PAGE_SIZE, output_schema: OUTPUT_SCHEMA }, null, 2).replace(/^/gm, '  ')},\n`)
  stream.write('  "artists": [\n')

  for (const key of target.keys) {
    const first = await fetchPage(key, 1)
    const total = Number(first.total || 0)
    const totalPage = Number(first.total_page || Math.ceil(total / PAGE_SIZE))
    bucketCounts[key] = {
      total_reported: total,
      total_page_reported: totalPage,
      rows_fetched: 0,
      rows_kept: 0,
    }

    function processRows(rows) {
      rowsFetched += rows.length
      bucketCounts[key].rows_fetched += rows.length
      for (const row of rows) {
        if (target.filter && !target.filter(row)) {
          filteredRows += 1
          continue
        }

        const dedupeKey = row.Fsinger_mid || row.Fsinger_id
        if (!dedupeKey) continue
        if (seen.has(dedupeKey)) {
          duplicateRows += 1
          continue
        }

        seen.add(dedupeKey)
        writeJsonValue(stream, buildArtist(row, key), firstArtist)
        artistCount += 1
        bucketCounts[key].rows_kept += 1
      }
    }

    processRows(first.list || [])

    const pages = []
    for (let page = 2; page <= totalPage; page += 1) pages.push(page)
    for (let index = 0; index < pages.length; index += BATCH_PAGES) {
      const batch = pages.slice(index, index + BATCH_PAGES)
      const pageData = await runPool(batch, (page) => fetchPage(key, page), CONCURRENCY)
      for (const data of pageData) processRows(data.list || [])
    }
  }

  const elapsedMs = Date.now() - started
  const stats = {
    rows_fetched: rowsFetched,
    artist_count: artistCount,
    duplicate_rows: duplicateRows,
    filtered_rows: filteredRows,
    elapsed_ms: elapsedMs,
    elapsed_seconds: Number((elapsedMs / 1000).toFixed(3)),
    concurrency: CONCURRENCY,
    bucket_counts: bucketCounts,
  }

  stream.write('\n  ],\n')
  stream.write(`  "stats": ${JSON.stringify(stats, null, 2).replace(/^/gm, '  ')}\n`)
  stream.write('}\n')
  await new Promise((resolve, reject) => {
    stream.end(resolve)
    stream.on('error', reject)
  })
  fs.renameSync(tmp, output)
  return { output, ...stats }
}

const command = process.argv[2]
if (!command) {
  usage()
  process.exit(1)
}

const targets = command === 'all-confirmed' ? ['cn', 'japan', 'korea'] : [command]
const results = []
for (const target of targets) {
  console.error(`[start] ${target}`)
  const result = await buildTarget(target)
  results.push(result)
  console.error(`[done] ${target}: ${result.artist_count} artists, ${result.elapsed_seconds}s`)
}

console.log(JSON.stringify({ results }, null, 2))
