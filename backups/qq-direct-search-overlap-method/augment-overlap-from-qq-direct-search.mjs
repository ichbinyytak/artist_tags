import { access, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.dirname(SCRIPT_DIR)

const QQ_NON_OVERLAP_FILE = path.join(ROOT_DIR, 'temp2', 'qq-artist-non-overlap-by-fans.json')
const OVERLAP_FILE = path.join(ROOT_DIR, 'database', 'overlap-artist-base.json')
const PROGRESS_FILE = path.join(ROOT_DIR, 'temp2', 'qq-direct-search-overlap-progress.json')
const REPORT_FILE = path.join(ROOT_DIR, 'temp2', 'qq-direct-search-overlap-report.json')

const START_INDEX = Number(process.env.QQ_DIRECT_START_INDEX || 0)
const LIMIT = Number(process.env.QQ_DIRECT_LIMIT || 999999)
const CONCURRENCY = Number(process.env.QQ_DIRECT_CONCURRENCY || 8)
const DELAY_MS = Number(process.env.QQ_DIRECT_DELAY_MS || 30)
const SEARCH_LIMIT = Number(process.env.QQ_DIRECT_SEARCH_LIMIT || 10)
const SAVE_EVERY = Number(process.env.QQ_DIRECT_SAVE_EVERY || 100)
const FETCH_RETRY = Number(process.env.QQ_DIRECT_FETCH_RETRY || 3)

const NETEASE_HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  Referer: 'https://music.163.com/',
}

const searchCache = new Map()
let saveChain = Promise.resolve()

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

async function writeJsonAtomic(file, payload) {
  const tempFile = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`
  await writeFile(tempFile, JSON.stringify(payload, null, 2) + '\n')
  await rename(tempFile, file)
}

function unique(values) {
  return [...new Set((values || []).filter((value) => value !== null && value !== undefined && value !== ''))]
}

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[·・.'’`-]/g, '')
    .replace(/\s+/g, ' ')
}

function compactKey(value) {
  return normalizeKey(value).replace(/\s+/g, '')
}

function extractNameParts(name) {
  const text = String(name || '').trim()
  const parts = [text]
  for (const match of text.matchAll(/(.+?)\s*[（(]([^()（）]+)[）)]/g)) {
    parts.push(match[1].trim(), match[2].trim())
  }
  return unique(parts)
}

function buildOverlapQqSet(artists) {
  return new Set(
    (artists || [])
      .map((artist) => artist?.platforms?.qq?.artist_id)
      .filter((id) => id !== null && id !== undefined && id !== '')
      .map(String),
  )
}

function collectQueries(artist) {
  const values = unique([
    artist?.name,
    ...(artist?.aliases || []),
    ...(artist?.name_keys || []),
  ].flatMap(extractNameParts))
    .map((value) => String(value || '').trim())
    .filter(Boolean)

  const normalizedSeen = new Set()
  const ranked = values
    .map((value) => {
      const compact = compactKey(value)
      const hasParen = /[()（）]/.test(value)
      const hasCjk = /[\u4e00-\u9fff]/.test(value)
      const hasLatin = /[A-Za-z]/.test(value)
      let priority = 0
      if (artist?.name && value === artist.name) priority += 100
      if (!hasParen) priority += 20
      if (hasCjk) priority += 10
      if (hasLatin && !hasCjk) priority += 8
      priority += Math.min(compact.length, 20)
      return { value, compact, priority }
    })
    .sort((a, b) => b.priority - a.priority || a.value.length - b.value.length)

  const queries = []
  for (const item of ranked) {
    if (!item.compact || normalizedSeen.has(item.compact)) continue
    normalizedSeen.add(item.compact)
    queries.push(item.value)
    if (queries.length >= 3) break
  }
  return queries
}

async function fetchJson(url, attempt = 1) {
  const response = await fetch(url, { headers: NETEASE_HEADERS })
  if ((response.status === 429 || response.status === 502 || response.status === 503) && attempt < FETCH_RETRY) {
    await sleep(DELAY_MS * attempt * 5)
    return fetchJson(url, attempt + 1)
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`)
  }
  return response.json()
}

async function searchNeteaseArtists(query) {
  const cacheKey = compactKey(query)
  if (searchCache.has(cacheKey)) return searchCache.get(cacheKey)
  const url = `https://music.163.com/api/search/get/web?type=100&s=${encodeURIComponent(query)}&limit=${SEARCH_LIMIT}&offset=0`
  const payload = await fetchJson(url)
  const artists = payload?.result?.artists || []
  const result = artists.map((artist) => ({
    artist_id: artist.id ?? null,
    name: artist.name ?? null,
    alias: unique(artist.alias || []),
    account_id: artist.accountId ?? null,
  }))
  searchCache.set(cacheKey, result)
  return result
}

function scoreHit(qqArtist, candidate, query) {
  const qqKeys = unique([
    qqArtist.name,
    ...(qqArtist.aliases || []),
    ...(qqArtist.name_keys || []),
  ]).flatMap(extractNameParts)

  const candidateKeys = unique([
    candidate.name,
    ...(candidate.alias || []),
  ]).flatMap(extractNameParts)

  const qqNormalized = unique([
    ...qqKeys.map(normalizeKey),
    ...qqKeys.map(compactKey),
  ])
  const candidateNormalized = unique([
    ...candidateKeys.map(normalizeKey),
    ...candidateKeys.map(compactKey),
  ])
  const queryNormalized = normalizeKey(query)

  let score = 0
  if (qqNormalized.includes(normalizeKey(candidate.name))) score += 60
  if (candidateNormalized.includes(normalizeKey(qqArtist.name))) score += 60
  if (qqNormalized.includes(compactKey(candidate.name))) score += 40
  if (candidateNormalized.includes(compactKey(qqArtist.name))) score += 40
  if (candidateNormalized.includes(queryNormalized)) score += 20
  if (qqNormalized.includes(queryNormalized)) score += 20
  return score
}

function isObviousMatch(qqArtist, top) {
  if (!top?.artist_id) return false

  const qqParts = unique([
    qqArtist?.name,
    ...(qqArtist?.aliases || []),
    ...(qqArtist?.name_keys || []),
  ].flatMap(extractNameParts))

  const neteaseParts = unique([
    top?.name,
    ...(top?.alias || []),
    ...extractNameParts(top?.name),
  ])

  const qqNormalized = unique([
    ...qqParts.map(normalizeKey),
    ...qqParts.map(compactKey),
  ]).filter(Boolean)

  const neteaseNormalized = unique([
    ...neteaseParts.map(normalizeKey),
    ...neteaseParts.map(compactKey),
  ]).filter(Boolean)

  return qqNormalized.some((name) => neteaseNormalized.includes(name))
}

function buildNames(qqArtist, topCandidate) {
  const parts = unique([
    String(qqArtist?.name || '').trim(),
    ...(qqArtist?.aliases || []),
    ...(extractNameParts(qqArtist?.name) || []),
    String(topCandidate?.name || '').trim(),
    ...(topCandidate?.alias || []),
    ...(extractNameParts(topCandidate?.name) || []),
  ]).filter(Boolean)

  const primary = String(qqArtist?.name || topCandidate?.name || '').trim()
  const aliases = parts.filter((name) => name !== primary)
  const en = parts.filter((name) => /[A-Za-z]/.test(name))
  const original = parts.filter((name) => /[ぁ-んァ-ン一-龯가-힣]/.test(name) && name !== primary)

  return {
    primary,
    zh_hans: /[\u4e00-\u9fff]/.test(primary) ? [primary] : [],
    zh_hant: [],
    en: unique(en),
    original: unique(original),
    aliases: unique(aliases),
  }
}

function buildNameKeys(qqArtist, topCandidate) {
  const raw = unique([
    qqArtist?.name,
    ...(qqArtist?.aliases || []),
    ...(qqArtist?.name_keys || []),
    topCandidate?.name,
    ...(topCandidate?.alias || []),
    ...extractNameParts(qqArtist?.name),
    ...extractNameParts(topCandidate?.name),
  ])

  return unique([
    ...raw.map((value) => String(value || '').trim()).filter(Boolean),
    ...raw.map(normalizeKey).filter(Boolean),
    ...raw.map(compactKey).filter(Boolean),
  ])
}

function buildOverlapArtist(qqArtist, top) {
  return {
    identity: {
      unified_key: `artist_pair:qq:${qqArtist.platform_ids?.qq}:netease:${top.artist_id}`,
      artist_type: qqArtist.artist_type ?? null,
      roles: ['singer'],
      names: buildNames(qqArtist, top),
      name_keys: buildNameKeys(qqArtist, top),
    },
    genres: {
      genres: unique(qqArtist.tags || []),
      subgenres: [],
    },
    tags: {
      regions: unique(qqArtist.regions || []),
      languages: unique(qqArtist.languages || []),
    },
    platforms: {
      qq: {
        artist_id: qqArtist.platform_ids?.qq ?? null,
        artist_mid: qqArtist.platform_ids?.qq_mid ?? null,
      },
      netease: {
        artist_id: top.artist_id ?? null,
      },
    },
    match: {
      status: 'strong',
      score: top.score ?? 0,
      quality: 0,
      matched_key: top.name ?? null,
    },
  }
}

async function saveState({ overlapPayload, progress }) {
  saveChain = saveChain.then(async () => {
    overlapPayload.generated_at = new Date().toISOString()
    overlapPayload.stats = {
      ...(overlapPayload.stats || {}),
      total_artists: overlapPayload.artists.length,
      strong_count: overlapPayload.artists.filter((artist) => artist?.match?.status === 'strong').length,
      probable_count: overlapPayload.artists.filter((artist) => artist?.match?.status === 'probable').length,
      ambiguous_count: overlapPayload.artists.filter((artist) => artist?.match?.status === 'ambiguous').length,
      qq_source_count: overlapPayload.artists.filter((artist) => artist?.platforms?.qq?.artist_id !== null && artist?.platforms?.qq?.artist_id !== undefined).length,
      netease_source_count: overlapPayload.artists.filter((artist) => artist?.platforms?.netease?.artist_id !== null && artist?.platforms?.netease?.artist_id !== undefined).length,
    }

    await writeJsonAtomic(OVERLAP_FILE, overlapPayload)
    await writeJsonAtomic(PROGRESS_FILE, progress)
    await writeJsonAtomic(REPORT_FILE, {
      generated_at: new Date().toISOString(),
      stats: progress.stats,
      recent_matches: progress.matches.slice(-50),
      recent_skips: progress.skips.slice(-50),
    })
  })
  await saveChain
}

async function main() {
  const qqPayload = JSON.parse(await readFile(QQ_NON_OVERLAP_FILE, 'utf8'))
  const overlapPayload = JSON.parse(await readFile(OVERLAP_FILE, 'utf8'))
  const overlapQqSet = buildOverlapQqSet(overlapPayload.artists || [])

  const sourceArtists = (qqPayload.artists || []).slice(START_INDEX, START_INDEX + LIMIT)

  const progress = await fileExists(PROGRESS_FILE)
    ? JSON.parse(await readFile(PROGRESS_FILE, 'utf8'))
    : {
        generated_at: new Date().toISOString(),
        start_index: START_INDEX,
        limit: LIMIT,
        stats: {
          source_count: sourceArtists.length,
          processed_count: 0,
          accepted_count: 0,
          skipped_count: 0,
          search_count: 0,
        },
        processed_qq_ids: [],
        matches: [],
        skips: [],
      }

  const processedSet = new Set((progress.processed_qq_ids || []).map(String))
  const queue = sourceArtists.filter((artist) => !processedSet.has(String(artist?.platform_ids?.qq ?? '')))

  let processedSinceSave = 0
  let nextIndex = 0

  async function worker() {
    while (true) {
      const current = nextIndex
      nextIndex += 1
      if (current >= queue.length) return

      const artist = queue[current]
      const qqId = String(artist?.platform_ids?.qq ?? '')
      const qqName = String(artist?.name || '').trim()

      if (!qqId) continue

      if (overlapQqSet.has(qqId)) {
        progress.stats.processed_count += 1
        progress.stats.skipped_count += 1
        progress.processed_qq_ids.push(qqId)
        progress.skips.push({ qq_artist_id: Number(qqId), qq_name: qqName, reason: 'already_in_overlap' })
        continue
      }

      const queries = collectQueries(artist)
      let top = null
      let queryUsed = null

      for (const query of queries) {
        await sleep(DELAY_MS)
        const hits = await searchNeteaseArtists(query)
        progress.stats.search_count += 1
        if (hits.length) {
          const ranked = hits
            .map((candidate) => ({
              ...candidate,
              score: scoreHit(artist, candidate, query),
            }))
            .sort((a, b) => (b.score - a.score) || String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hans-CN'))
          top = ranked[0] || null
          queryUsed = query
          break
        }
      }

      if (top && isObviousMatch(artist, top)) {
        const overlapArtist = buildOverlapArtist(artist, top)
        overlapPayload.artists.push(overlapArtist)
        overlapQqSet.add(qqId)
        progress.stats.accepted_count += 1
        progress.matches.push({
          qq_artist_id: Number(qqId),
          qq_name: qqName,
          netease_artist_id: top.artist_id,
          netease_name: top.name,
          score: top.score ?? 0,
          query_used: queryUsed,
        })
      } else {
        progress.stats.skipped_count += 1
        progress.skips.push({
          qq_artist_id: Number(qqId),
          qq_name: qqName,
          reason: top ? 'search_not_obvious_match' : 'search_no_result',
          query_used: queryUsed,
          top_candidate_name: top?.name ?? null,
          top_candidate_id: top?.artist_id ?? null,
          score: top?.score ?? null,
        })
      }

      progress.stats.processed_count += 1
      progress.processed_qq_ids.push(qqId)
      processedSinceSave += 1

      if (processedSinceSave >= SAVE_EVERY) {
        await saveState({ overlapPayload, progress })
        processedSinceSave = 0
      }
    }
  }

  const workers = Array.from({ length: Math.max(1, CONCURRENCY) }, () => worker())
  await Promise.all(workers)
  await saveState({ overlapPayload, progress })

  console.log(JSON.stringify({
    processed_count: progress.stats.processed_count,
    accepted_count: progress.stats.accepted_count,
    skipped_count: progress.stats.skipped_count,
    search_count: progress.stats.search_count,
    total_overlap_after: overlapPayload.artists.length,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
