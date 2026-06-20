import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.dirname(path.dirname(SCRIPT_DIR))
const DEFAULT_OUTPUT = 'temp1/tag-source-research/cn-five-tag-evidence-run.preview.json'
const USER_AGENT = 'artist-database-tag-research/0.1 (local preview; contact: research@example.invalid)'
const STYLE_TERMS = [
  '华语流行', '華語流行', '国语流行', '國語流行', '流行', '民谣', '民謠', '独立音乐', '獨立音樂',
  '另类摇滚', '另類搖滾', '独立摇滚', '獨立搖滾', '后摇滚', '後搖滾', '油渍摇滚', '油漬搖滾',
  '硬摇滚', '硬搖滾', '说唱金属', '說唱金屬', '饶舌金属', '饒舌金屬', '硬核', '摇滚', '搖滾',
  '雷鬼', '说唱', '說唱', '嘻哈',
  '国风', '國風', '中国风', '中國風', '电子', '電子',
  'R&B', '节奏布鲁斯', '節奏藍調', '唱作', 'Mandopop', 'pop', 'contemporary folk', 'folk',
  'pop rap', 'indie rock', 'alternative rock', 'post-rock', 'hard rock', 'rock', 'hip hop', 'rap', 'trap',
  'zhongguo feng', 'contemporary r&b', 'r&b', 'electronic', 'singer-songwriter',
]

const SAMPLES = [
  {
    artist_key: 'qq:4558|wy:6452',
    research_name: '周杰伦',
    query_names: ['周杰伦', '周杰倫', 'Jay Chou'],
    baidu_lemma_id: 129156,
    qq_music_wiki_url: 'https://wiki.y.qq.com/i/c6a607u3deasnfhmmgg0',
    wikipedia_title: '周杰倫',
    mb_query: '周杰倫',
    expected_type: 'Person',
  },
  {
    artist_key: 'qq:40449|wy:6731',
    research_name: '赵雷',
    query_names: ['赵雷', '趙雷', 'Zhao Lei'],
    wikipedia_title: '赵雷',
    mb_query: '赵雷',
    expected_type: 'Person',
  },
  {
    artist_key: 'qq:1121441|wy:1211046',
    research_name: 'GAI周延',
    query_names: ['GAI周延', 'GAI', '周延'],
    wikipedia_title: 'GAI',
    mb_query: 'GAI周延',
    expected_type: 'Person',
  },
  {
    artist_key: 'qq:1144419|wy:1161122',
    research_name: '草东没有派对',
    query_names: ['草东没有派对', '草東沒有派對', 'No Party For Cao Dong'],
    wikipedia_title: '草東沒有派對',
    mb_query: '草東沒有派對',
    expected_type: 'Group',
  },
  {
    artist_key: 'qq:13930|wy:12971',
    research_name: '痛仰乐队',
    query_names: ['痛仰乐队', '痛仰', 'Miserable Faith'],
    wikipedia_title: '痛仰乐队',
    mb_query: '痛仰乐队',
    expected_type: 'Group',
  },
]

const EXACT_MAPPINGS = [
  { aliases: ['华语流行', '華語流行', '国语流行', '國語流行', 'mandopop'], code: '01.02', name_zh: '华语流行', name_en: 'C-Pop' },
  { aliases: ['流行', 'pop'], code: '01.01', name_zh: '流行', name_en: 'Pop' },
  { aliases: ['民谣', '民謠', 'contemporary folk', 'folk'], code: '04.01', name_zh: '民谣', name_en: 'Folk' },
  { aliases: ['说唱', '說唱', '嘻哈', 'hip hop', 'rap'], code: '05.01', name_zh: '嘻哈/说唱', name_en: 'Hip-Hop / Rap' },
  { aliases: ['中国风', '中國風', '国风', '國風', 'zhongguo feng'], code: '11.04', name_zh: '中国风', name_en: 'Chinese Style' },
  { aliases: ['contemporary r&b'], code: '06.03', name_zh: '当代 R&B', name_en: 'Contemporary R&B' },
  { aliases: ['r&b', '节奏布鲁斯', '節奏藍調'], code: '06.01', name_zh: 'R&B', name_en: 'R&B' },
  { aliases: ['另类摇滚', '另類搖滾', 'alternative rock'], code: '02.03', name_zh: '另类摇滚', name_en: 'Alternative Rock' },
  { aliases: ['后摇滚', '後搖滾', 'post-rock'], code: '02.05', name_zh: '后摇', name_en: 'Post-Rock' },
  { aliases: ['硬摇滚', '硬搖滾', 'hard rock'], code: '02.04', name_zh: '硬摇滚', name_en: 'Hard Rock' },
  { aliases: ['摇滚', '搖滾', 'rock'], code: '02.01', name_zh: '摇滚', name_en: 'Rock' },
  { aliases: ['电子', '電子', 'electronic'], code: '03.01', name_zh: '电子', name_en: 'Electronic' },
  { aliases: ['雷鬼', 'reggae'], code: '11.07', name_zh: '雷鬼', name_en: 'Reggae' },
  { aliases: ['唱作', 'singer-songwriter'], code: '90.01', name_zh: '唱作', name_en: 'Singer-Songwriter' },
]
const EXACT_MAPPING_BY_ALIAS = new Map(
  EXACT_MAPPINGS.flatMap((mapping) => mapping.aliases.map((alias) => [alias.toLowerCase(), mapping])),
)

function parseArgs(argv) {
  const options = { output: DEFAULT_OUTPUT }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--output') {
      options.output = argv[index + 1]
      index += 1
    } else if (arg === '--help' || arg === '-h') {
      options.help = true
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  return options
}

function usage() {
  console.log([
    'Usage:',
    '  node scripts/tags/fetch-cn-five-tag-evidence-preview.mjs [--output <json>]',
    '',
    'Fetches multi-source raw style evidence for five Chinese-language preview artists.',
    'The output is research evidence only and is not a formal light tag table.',
  ].join('\n'))
}

function absolutePath(file) {
  return path.isAbsolute(file) ? file : path.join(ROOT_DIR, file)
}

function relativePath(file) {
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

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function normalizeName(value) {
  return String(value || '').toLowerCase().replaceAll(/\s|[()（）/._-]/g, '')
}

function artistIds(artistKey) {
  const qq = artistKey.match(/qq:(\d+)/)?.[1]
  const wy = artistKey.match(/wy:(\d+)/)?.[1]
  return { qq, wy }
}

function htmlToText(value) {
  return String(value || '')
    .replaceAll(/<script[\s\S]*?<\/script>/gi, ' ')
    .replaceAll(/<style[\s\S]*?<\/style>/gi, ' ')
    .replaceAll(/<[^>]*>/g, ' ')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll(/\s+/g, ' ')
    .trim()
}

function extractStyleTerms(text) {
  const lowerText = String(text || '').toLowerCase()
  const occupied = []
  const hits = []
  for (const term of [...STYLE_TERMS].sort((a, b) => b.length - a.length)) {
    const searchTerm = term.toLowerCase()
    let start = lowerText.indexOf(searchTerm)
    while (start >= 0) {
      const end = start + searchTerm.length
      if (!occupied.some(([from, to]) => start < to && end > from)) {
        occupied.push([start, end])
        hits.push({ term, start })
      }
      start = lowerText.indexOf(searchTerm, start + 1)
    }
  }
  return unique(hits.sort((a, b) => a.start - b.start).map((hit) => hit.term))
}

function shortText(text, max = 600) {
  const cleaned = String(text || '').replaceAll(/\s+/g, ' ').trim()
  return cleaned.length <= max ? cleaned : `${cleaned.slice(0, max)}...`
}

function textWindows(text, terms, max = 4) {
  const clean = String(text || '').replaceAll(/\s+/g, ' ').trim()
  const windows = []
  for (const term of terms) {
    const index = clean.toLowerCase().indexOf(term.toLowerCase())
    if (index < 0) continue
    windows.push(shortText(clean.slice(Math.max(0, index - 45), index + term.length + 65), 150))
  }
  return unique(windows).slice(0, max)
}

async function request(url, { responseType = 'json', timeoutMs = 15000, headers = {} } = {}) {
  const started = Date.now()
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, ...headers },
      signal: AbortSignal.timeout(timeoutMs),
    })
    const elapsedMs = Date.now() - started
    if (!response.ok) {
      return { ok: false, status: response.status, elapsed_ms: elapsedMs, error: `HTTP ${response.status}` }
    }
    const body = responseType === 'json' ? await response.json() : await response.text()
    return { ok: true, status: response.status, elapsed_ms: elapsedMs, body }
  } catch (error) {
    return { ok: false, status: null, elapsed_ms: Date.now() - started, error: error.message }
  }
}

async function requestWithRetry(url, options = {}, maxAttempts = 2) {
  const failures = []
  let totalElapsedMs = 0
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await request(url, options)
    totalElapsedMs += result.elapsed_ms
    if (result.ok) {
      return { ...result, elapsed_ms: totalElapsedMs, attempt_count: attempt, previous_failures: failures }
    }
    failures.push({ attempt, status: result.status, error: result.error })
    if (result.status && result.status !== 429 && result.status < 500) {
      return { ...result, elapsed_ms: totalElapsedMs, attempt_count: attempt, previous_failures: failures }
    }
    if (attempt < maxAttempts) await sleep(1000 * attempt)
  }
  const last = failures[failures.length - 1]
  return { ok: false, status: last.status, elapsed_ms: totalElapsedMs, error: last.error, attempt_count: maxAttempts, previous_failures: failures }
}

function compactCandidate(candidate) {
  return {
    id: candidate.id,
    score: candidate.score,
    name: candidate.name,
    type: candidate.type || null,
    country: candidate.country || null,
    area: candidate.area?.name || null,
    disambiguation: candidate.disambiguation || null,
    aliases: (candidate.aliases || []).map((alias) => alias.name).slice(0, 5),
    search_tags: (candidate.tags || []).map((tag) => tag.name),
  }
}

function matchesQueryName(candidate, sample) {
  const accepted = new Set(sample.query_names.map(normalizeName))
  const names = [candidate.name, ...(candidate.aliases || []).map((alias) => alias.name)]
  return names.some((name) => accepted.has(normalizeName(name)))
}

let lastMusicBrainzRequestAt = 0
async function musicBrainzRequest(url) {
  const waitMs = Math.max(0, 1100 - (Date.now() - lastMusicBrainzRequestAt))
  if (waitMs) await sleep(waitMs)
  const result = await requestWithRetry(url, {}, 2)
  lastMusicBrainzRequestAt = Date.now()
  return result
}

async function fetchMusicBrainz(sample) {
  const url = new URL('https://musicbrainz.org/ws/2/artist/')
  url.searchParams.set('query', `artist:"${sample.mb_query}"`)
  url.searchParams.set('fmt', 'json')
  url.searchParams.set('limit', '5')
  const search = await musicBrainzRequest(url)
  if (!search.ok) return { source: 'musicbrainz', ...search }

  const candidates = (search.body.artists || []).map(compactCandidate)
  const rawSelected = (search.body.artists || []).find((candidate) => (
    matchesQueryName(candidate, sample) && (!sample.expected_type || candidate.type === sample.expected_type)
  ))
  if (!rawSelected) {
    return {
      source: 'musicbrainz',
      ok: true,
      status: search.status,
      elapsed_ms: search.elapsed_ms,
      match_status: 'needs_review',
      candidates,
      raw_tags: [],
    }
  }
  const detailUrl = new URL(`https://musicbrainz.org/ws/2/artist/${rawSelected.id}`)
  detailUrl.searchParams.set('inc', 'genres+tags+aliases')
  detailUrl.searchParams.set('fmt', 'json')
  const detail = await musicBrainzRequest(detailUrl)
  if (!detail.ok) {
    return {
      source: 'musicbrainz',
      ok: false,
      status: detail.status,
      elapsed_ms: search.elapsed_ms + detail.elapsed_ms,
      match_status: 'matched_detail_failed',
      matched_candidate: compactCandidate(rawSelected),
      candidates,
      error: detail.error,
    }
  }
  const genres = (detail.body.genres || []).map((genre) => genre.name)
  const tags = (detail.body.tags || []).map((tag) => tag.name)
  return {
    source: 'musicbrainz',
    ok: true,
    status: detail.status,
    elapsed_ms: search.elapsed_ms + detail.elapsed_ms,
    match_status: 'auto_matched_by_name_and_type',
    normalization_eligible: true,
    matched_candidate: compactCandidate(rawSelected),
    candidates,
    genres,
    tags,
    raw_tags: unique([...genres, ...tags]),
  }
}

async function fetchNetease(sample) {
  const { wy } = artistIds(sample.artist_key)
  const result = await request(`https://music.163.com/api/artist/introduction?id=${wy}`, {
    headers: { Referer: 'https://music.163.com/' },
  })
  if (!result.ok) return { source: 'netease_introduction', ...result }
  const sections = (result.body.introduction || []).map((part) => part.txt)
  const text = [result.body.briefDesc, ...sections].filter(Boolean).join('\n')
  const rawTags = extractStyleTerms(text)
  return {
    source: 'netease_introduction',
    ok: true,
    status: result.status,
    elapsed_ms: result.elapsed_ms,
    match_status: 'matched_by_netease_id',
    raw_tags: rawTags,
    normalization_eligible: false,
    normalization_note: 'Biography term hits require contextual review before artist-level style assignment.',
    evidence_windows: textWindows(text, rawTags),
    brief_description: shortText(result.body.briefDesc, 250),
  }
}

async function fetchQQMusicWiki(sample) {
  if (!sample.qq_music_wiki_url) {
    return {
      source: 'qq_music_wiki',
      ok: false,
      match_status: 'not_configured',
      raw_tags: [],
    }
  }
  const result = await request(sample.qq_music_wiki_url, {
    responseType: 'text',
    headers: { Referer: 'https://wiki.y.qq.com/' },
  })
  if (!result.ok) return { source: 'qq_music_wiki', ...result, raw_tags: [] }

  const title = htmlToText(result.body.match(/<title[^>]*>(.*?)<\/title>/i)?.[1] || '')
  const metaDescription = htmlToText(result.body.match(/<meta name="description" content="([^"]*)"/i)?.[1] || '')
  const pageDescription = htmlToText(result.body.match(/<page\s+[\s\S]*?description="([^"]*)"/i)?.[1] || '')
  const description = pageDescription || metaDescription
  const pageText = htmlToText(result.body)
  const descriptionTags = extractStyleTerms(description)
  const textTags = extractStyleTerms(pageText)
  const accepted = new Set(sample.query_names.map(normalizeName))
  const titleMatched = accepted.has(normalizeName(title))

  return {
    source: 'qq_music_wiki',
    ok: true,
    status: result.status,
    elapsed_ms: result.elapsed_ms,
    match_status: titleMatched ? 'matched_by_configured_url_and_title' : 'configured_url_title_needs_review',
    normalization_eligible: titleMatched,
    page_url: sample.qq_music_wiki_url,
    title,
    description,
    raw_tags: descriptionTags,
    body_style_terms_for_review: textTags.filter((term) => !descriptionTags.includes(term)),
    evidence_windows: textWindows(pageText, textTags),
  }
}

async function fetchWikipedia(sample) {
  const url = new URL('https://zh.wikipedia.org/w/api.php')
  url.searchParams.set('action', 'query')
  url.searchParams.set('prop', 'revisions')
  url.searchParams.set('titles', sample.wikipedia_title)
  url.searchParams.set('rvprop', 'content')
  url.searchParams.set('rvslots', 'main')
  url.searchParams.set('formatversion', '2')
  url.searchParams.set('format', 'json')
  url.searchParams.set('origin', '*')
  const result = await requestWithRetry(url, {}, 2)
  if (!result.ok) return { source: 'wikipedia_zh', ...result }
  const page = result.body.query?.pages?.[0]
  if (!page || page.missing) {
    return { source: 'wikipedia_zh', ok: true, status: result.status, elapsed_ms: result.elapsed_ms, match_status: 'not_found', raw_tags: [] }
  }
  const text = page.revisions?.[0]?.slots?.main?.content || ''
  const lines = text.split('\n')
  const genreLines = []
  const start = lines.findIndex((line) => /^\s*\|\s*(音乐类型|音樂類型|genre|曲风|曲風)\s*=/i.test(line))
  if (start >= 0) {
    genreLines.push(lines[start])
    if (lines[start].includes('{{')) {
      for (const line of lines.slice(start + 1, start + 10)) {
        if (/^\s*\|\s*[^*]/.test(line)) break
        genreLines.push(line)
        if (line.includes('}}')) break
      }
    }
  }
  const evidenceText = genreLines.length ? genreLines.join(' ') : text.slice(0, 4000)
  const rawTags = extractStyleTerms(evidenceText)
  return {
    source: 'wikipedia_zh',
    ok: true,
    status: result.status,
    elapsed_ms: result.elapsed_ms,
    match_status: 'matched_by_curated_page_title',
    normalization_eligible: true,
    page_title: page.title,
    page_url: `https://zh.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
    raw_tags: rawTags,
    evidence_lines: genreLines.map((line) => shortText(line, 240)),
  }
}

async function fetchBaiduBaike(sample) {
  const accepted = new Set(sample.query_names.map(normalizeName))
  for (const queryName of sample.query_names) {
    let apiResult = null
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const apiUrl = new URL('https://baike.baidu.com/api/openapi/BaikeLemmaCardApi')
      apiUrl.searchParams.set('scope', '103')
      apiUrl.searchParams.set('format', 'json')
      apiUrl.searchParams.set('appid', '379020')
      apiUrl.searchParams.set('bk_key', queryName)
      apiUrl.searchParams.set('bk_length', '1000')
      apiResult = await request(apiUrl, {
        headers: { Referer: 'https://baike.baidu.com/' },
      })
      if (apiResult.ok && !apiResult.body?.errno) break
      if (attempt < 3) await sleep(800 * attempt)
    }
    if (!apiResult?.ok) continue
    if (apiResult.body?.errno) continue

    const title = apiResult.body.title || apiResult.body.key || ''
    const key = apiResult.body.key || ''
    const titleMatched = [title, key].some((name) => accepted.has(normalizeName(name)))
    if (!titleMatched) continue

    const cardEntries = apiResult.body.card || []
    const styleCardText = cardEntries
      .filter((entry) => /音乐类型|音樂類型|风格|風格|曲风|曲風/i.test(entry.name || ''))
      .flatMap((entry) => [...(entry.value || []), ...(entry.format || [])])
      .map(htmlToText)
      .join(' ')
    const reviewCardText = cardEntries
      .filter((entry) => !/音乐类型|音樂類型|风格|風格|曲风|曲風/i.test(entry.name || ''))
      .flatMap((entry) => [...(entry.value || []), ...(entry.format || [])])
      .map(htmlToText)
      .join(' ')
    const evidenceText = [apiResult.body.desc, styleCardText].filter(Boolean).join(' ')
    const rawTags = extractStyleTerms(evidenceText)
    const reviewTags = extractStyleTerms(reviewCardText).filter((term) => !rawTags.includes(term))
    const lemmaId = apiResult.body.newLemmaId || apiResult.body.subLemmaId || apiResult.body.id || null
    return {
      source: 'baidu_baike',
      ok: true,
      status: apiResult.status,
      elapsed_ms: apiResult.elapsed_ms,
      match_status: 'api_matched_by_title_or_key',
      normalization_eligible: true,
      query_name: queryName,
      lemma_id: lemmaId,
      title,
      key,
      page_url: lemmaId ? `https://baike.baidu.com/item/${encodeURIComponent(title)}/${lemmaId}` : null,
      raw_tags: rawTags,
      card_style_terms_for_review: reviewTags,
      description: shortText(apiResult.body.desc, 300),
      evidence_windows: textWindows(evidenceText, rawTags),
    }
  }

  const pagePath = sample.baidu_lemma_id
    ? `${encodeURIComponent(sample.research_name)}/${sample.baidu_lemma_id}`
    : encodeURIComponent(sample.research_name)
  const result = await request(`https://baike.baidu.com/item/${pagePath}`, {
    responseType: 'text',
    headers: { Referer: 'https://baike.baidu.com/' },
  })
  if (!result.ok) return { source: 'baidu_baike', ...result, raw_tags: [] }
  const descriptionMatch = result.body.match(/<meta[^>]+(?:name=["']description["'][^>]+content=["']([^"']+)|content=["']([^"']+)["'][^>]+name=["']description["'])/i)
  const description = htmlToText(descriptionMatch?.[1] || descriptionMatch?.[2] || '')
  const fallbackText = htmlToText(result.body).slice(0, 5000)
  const evidenceText = description || fallbackText
  const rawTags = extractStyleTerms(evidenceText)
  return {
    source: 'baidu_baike',
    ok: true,
    status: result.status,
    elapsed_ms: result.elapsed_ms,
    match_status: description ? 'page_returned_description' : 'page_returned_needs_review',
    page_url: `https://baike.baidu.com/item/${pagePath}`,
    raw_tags: rawTags,
    normalization_eligible: Boolean(description),
    description: shortText(description, 300),
    evidence_windows: textWindows(evidenceText, rawTags),
  }
}

async function fetchApple(sample) {
  const url = new URL('https://itunes.apple.com/search')
  url.searchParams.set('term', sample.research_name)
  url.searchParams.set('media', 'music')
  url.searchParams.set('entity', 'musicArtist')
  url.searchParams.set('country', 'CN')
  url.searchParams.set('limit', '10')
  const result = await request(url)
  if (!result.ok) return { source: 'apple_search', ...result }
  const candidates = (result.body.results || []).map((candidate) => ({
    artist_id: candidate.artistId,
    artist_name: candidate.artistName,
    primary_genre_name: candidate.primaryGenreName || null,
    artist_link_url: candidate.artistLinkUrl || null,
  }))
  const accepted = new Set(sample.query_names.map(normalizeName))
  const matches = candidates.filter((candidate) => accepted.has(normalizeName(candidate.artist_name)))
  const match = matches.length === 1 ? matches[0] : null
  return {
    source: 'apple_search',
    ok: true,
    status: result.status,
    elapsed_ms: result.elapsed_ms,
    match_status: match ? 'auto_matched_by_unique_exact_alias' : 'needs_identity_review',
    normalization_eligible: Boolean(match),
    matched_candidate: match || null,
    candidates: candidates.slice(0, 5),
    raw_tags: match?.primary_genre_name ? [match.primary_genre_name] : [],
  }
}

function deriveNormalizedCandidates(sources) {
  const byCode = new Map()
  for (const source of sources) {
    if (source.normalization_eligible === false) continue
    for (const rawTag of source.raw_tags || []) {
      const mapping = EXACT_MAPPING_BY_ALIAS.get(rawTag.toLowerCase())
      if (!mapping) continue
      if (!byCode.has(mapping.code)) {
        byCode.set(mapping.code, {
          style_code: mapping.code,
          name_zh: mapping.name_zh,
          name_en: mapping.name_en,
          evidence: [],
        })
      }
      byCode.get(mapping.code).evidence.push({ source: source.source, raw_tag: rawTag })
    }
  }
  return [...byCode.values()].map((entry) => ({ ...entry, evidence: unique(entry.evidence.map((e) => JSON.stringify(e))).map((e) => JSON.parse(e)) }))
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    usage()
    return
  }

  const startedAt = Date.now()
  const outputFile = absolutePath(options.output)
  const qq = await readJson(path.join(ROOT_DIR, 'data/platform-source/qq/qq-artist-stats-backup.json'))
  const netease = await readJson(path.join(ROOT_DIR, 'data/platform-source/netease/netease-artist-stats-backup.json'))
  const qqRaw = await readJson(path.join(ROOT_DIR, 'temp1/qq-tag-previous-tables/raw-qq-snapshots/qq-v8-cn-artist-tags.json'))
  const results = []

  for (const [index, sample] of SAMPLES.entries()) {
    const { qq: qqId, wy: wyId } = artistIds(sample.artist_key)
    const qqItem = qq.artists.find((artist) => String(artist.artist_id) === qqId)
    const wyItem = netease.artists.find((artist) => String(artist.artist_id ?? artist.id) === wyId)
    const rawItem = qqRaw.items.find((artist) => String(artist.qq_artist_id) === qqId)
    const localSources = [
      {
        source: 'qq_original_readable_tags',
        ok: Boolean(qqItem),
        match_status: qqItem ? 'matched_by_qq_id' : 'not_found',
        normalization_eligible: true,
        raw_tags: qqItem?.tags || [],
      },
      {
        source: 'qq_v8_raw_numeric_tags',
        ok: Boolean(rawItem),
        match_status: rawItem ? 'matched_by_qq_id' : 'not_found',
        normalization_eligible: false,
        raw_tag_ids: rawItem?.qq_raw_tag_ids || [],
        raw_tags: [],
      },
    ]
    const networkSources = []
    networkSources.push(await fetchNetease(sample))
    networkSources.push(await fetchQQMusicWiki(sample))
    networkSources.push(await fetchMusicBrainz(sample))
    networkSources.push(await fetchWikipedia(sample))
    await sleep(1500)
    networkSources.push(await fetchBaiduBaike(sample))
    await sleep(500)
    networkSources.push(await fetchApple(sample))
    const sources = [...localSources, ...networkSources]

    results.push({
      artist_key: sample.artist_key,
      research_identity: {
        requested_name: sample.research_name,
        query_names: sample.query_names,
        qq_local_name: qqItem?.name || null,
        netease_local_name: wyItem?.name || null,
      },
      sources,
      normalized_candidates_preview: deriveNormalizedCandidates(sources),
      unmatched_raw_style_terms: unique(
        sources.flatMap((source) => source.raw_tags || []).filter((rawTag) => !EXACT_MAPPING_BY_ALIAS.has(rawTag.toLowerCase())),
      ),
    })
    console.log(`[${index + 1}/${SAMPLES.length}] ${sample.research_name} completed`)
  }

  const elapsedMs = Date.now() - startedAt
  const payload = {
    version: 1,
    status: 'external_tag_evidence_preview_not_formal_table',
    generated_at: new Date().toISOString(),
    description: 'Real five-artist multi-source collection run. Names and evidence are intentionally stored only in this temporary research output.',
    sources_attempted: ['qq_original_readable_tags', 'qq_v8_raw_numeric_tags', 'netease_introduction', 'qq_music_wiki', 'musicbrainz', 'wikipedia_zh', 'baidu_baike', 'apple_search'],
    run_stats: {
      artist_count: results.length,
      elapsed_ms: elapsedMs,
      elapsed_seconds: Number((elapsedMs / 1000).toFixed(3)),
      source_success_counts: Object.fromEntries(
        ['netease_introduction', 'qq_music_wiki', 'musicbrainz', 'wikipedia_zh', 'baidu_baike', 'apple_search'].map((source) => [
          source,
          results.filter((item) => item.sources.find((entry) => entry.source === source)?.ok).length,
        ]),
      ),
    },
    items: results,
  }

  await saveJson(outputFile, payload)
  console.log(JSON.stringify({ ok: true, output: relativePath(outputFile), elapsed_seconds: payload.run_stats.elapsed_seconds }, null, 2))
}

await main()
