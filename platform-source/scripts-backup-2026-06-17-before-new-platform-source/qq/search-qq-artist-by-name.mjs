import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const SMARTBOX_URL = 'https://c.y.qq.com/splcloud/fcgi-bin/smartbox_new.fcg'
const MUSICU_URL = 'https://u.y.qq.com/cgi-bin/musicu.fcg'

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

const HEADERS = {
  Referer: 'https://y.qq.com/',
  'User-Agent': 'Mozilla/5.0',
}

function usage() {
  console.log([
    'Usage:',
    '  node search-qq-artist-by-name.mjs --query <artist-name> [--output <json>] [--top-n 10]',
    '',
    'Example:',
    '  node platform-source/scripts-backup-2026-06-17-before-new-platform-source/qq/search-qq-artist-by-name.mjs --query 结冰水',
  ].join('\n'))
}

function parseArgs(argv) {
  const options = {
    query: null,
    output: null,
    topN: 10,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--help' || arg === '-h') {
      options.help = true
      continue
    }
    if (arg === '--query') {
      options.query = argv[index + 1] || null
      index += 1
      continue
    }
    if (arg === '--output') {
      options.output = argv[index + 1] || null
      index += 1
      continue
    }
    if (arg === '--top-n') {
      options.topN = Number(argv[index + 1] || 10)
      index += 1
      continue
    }
    throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

function normalizeName(value) {
  return String(value || '')
    .trim()
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[·・.。'’`_\-—–,，/|;；、]/g, '')
    .replace(/\s+/g, '')
}

function compactCandidate(item, rank, query) {
  const name = item.name || item.singer || ''
  const mid = item.mid || ''
  const id = String(item.id || item.docid || '')
  return {
    rank,
    qq_artist_id: id,
    qq_artist_mid: mid,
    qq_name: name,
    singer: item.singer || null,
    pic: item.pic || null,
    qq_link: mid ? `https://y.qq.com/n/ryqq_v2/singer/${mid}` : null,
    exact_name_match: normalizeName(name) === normalizeName(query),
  }
}

async function searchQqSmartbox(query, topN) {
  const url = new URL(SMARTBOX_URL)
  url.searchParams.set('key', query)
  url.searchParams.set('format', 'json')
  url.searchParams.set('inCharset', 'utf8')
  url.searchParams.set('outCharset', 'utf-8')
  url.searchParams.set('platform', 'yqq.json')
  url.searchParams.set('needNewCode', '0')

  const response = await fetch(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} from QQ smartbox`)

  const json = await response.json()
  const rows = json?.data?.singer?.itemlist || []
  return rows.slice(0, topN).map((item, index) => compactCandidate(item, index + 1, query))
}

async function fetchSingerDetails(candidates) {
  const withMid = candidates.filter((candidate) => candidate.qq_artist_mid)
  if (!withMid.length) return new Map()

  const requests = {}
  withMid.forEach((candidate, index) => {
    requests[`req_${index}`] = {
      module: 'music.web_singer_info_svr',
      method: 'get_singer_detail_info',
      param: {
        singermid: candidate.qq_artist_mid,
      },
    }
  })

  const response = await fetch(MUSICU_URL, {
    method: 'POST',
    headers: {
      ...HEADERS,
      'Content-Type': 'application/json',
      Origin: 'https://y.qq.com',
    },
    body: JSON.stringify({
      comm: DEFAULT_COMM,
      ...requests,
    }),
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} from QQ musicu`)

  const json = await response.json()
  const byMid = new Map()
  withMid.forEach((candidate, index) => {
    const data = json?.[`req_${index}`]?.data || null
    if (!data) return
    byMid.set(candidate.qq_artist_mid, {
      song_count: Number.isFinite(Number(data.total_song)) ? Number(data.total_song) : null,
      album_count: Number.isFinite(Number(data.total_album)) ? Number(data.total_album) : null,
      fan_count: Number.isFinite(Number(data.singer_info?.fans)) ? Number(data.singer_info.fans) : null,
      detail_name: data.singer_info?.name || null,
      detail_id: data.singer_info?.id ? String(data.singer_info.id) : null,
      detail_mid: data.singer_info?.mid || null,
    })
  })

  return byMid
}

async function saveJson(file, payload) {
  await mkdir(path.dirname(path.resolve(file)), { recursive: true })
  await writeFile(file, `${JSON.stringify(payload, null, 2)}\n`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help || !options.query) {
    usage()
    if (!options.help) process.exitCode = 1
    return
  }

  const startedAt = Date.now()
  const candidates = await searchQqSmartbox(options.query, options.topN)
  const detailsByMid = await fetchSingerDetails(candidates)
  const items = candidates.map((candidate) => ({
    ...candidate,
    ...(detailsByMid.get(candidate.qq_artist_mid) || {
      song_count: null,
      album_count: null,
      fan_count: null,
      detail_name: null,
      detail_id: null,
      detail_mid: null,
    }),
  }))

  const exactMatches = items.filter((item) => item.exact_name_match)
  const payload = {
    generated_at: new Date().toISOString(),
    query: options.query,
    source: {
      search_endpoint: SMARTBOX_URL,
      detail_endpoint: MUSICU_URL,
      search_method: 'QQ smartbox singer search by name, then QQ singer detail by qq_artist_mid',
    },
    stats: {
      elapsed_ms: Date.now() - startedAt,
      candidate_count: items.length,
      exact_match_count: exactMatches.length,
    },
    best_match: exactMatches[0] || items[0] || null,
    items,
  }

  if (options.output) await saveJson(options.output, payload)
  console.log(JSON.stringify(payload, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
