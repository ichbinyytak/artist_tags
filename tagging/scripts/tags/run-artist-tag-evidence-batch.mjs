import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.dirname(path.dirname(SCRIPT_DIR))
const USER_AGENT = 'artist-database-tag-run/0.1'
const TAXONOMY_FILE = path.join(ROOT_DIR, 'data/platform-source/qq/v8/dictionaries/standard-style-taxonomy.json')
const AMBIGUOUS_FREE_TEXT_TERMS = new Set([
  '民族',
  '当代',
  '當代',
  'dan',
  '旦',
  '贝斯',
  '貝斯',
  'bass',
  'country',
  'house',
  'opera',
  '古典',
])

const STYLE_TERMS = [
  '华语流行', '華語流行', '国语流行', '國語流行', '粤语流行', '粵語流行', '流行',
  '民谣', '民謠', '独立音乐', '獨立音樂', '另类摇滚', '另類搖滾', '独立摇滚', '獨立搖滾',
  '后摇滚', '後搖滾', '油渍摇滚', '油漬搖滾', '硬摇滚', '硬搖滾', '说唱金属', '說唱金屬',
  '饶舌金属', '饒舌金屬', '硬核', '摇滚', '搖滾', '雷鬼', '说唱', '說唱', '嘻哈',
  '国风', '國風', '中国风', '中國風', '电子', '電子', 'R&B', '节奏布鲁斯', '節奏藍調',
  '唱作', 'Mandopop', 'Cantopop', 'C-Pop', 'K-Pop', 'J-Pop', 'pop rap', 'pop rock',
  'indie rock', 'alternative rock', 'post-rock',
  'grunge', 'hard rock', 'rap metal', 'hardcore', 'rock', 'hip hop', 'rap', 'trap',
  'zhongguo feng', 'contemporary r&b', 'r&b', 'electronic', 'singer-songwriter',
  'hong kong rock band', '国际流行', '舞曲', '乡村', 'soul', '中国摇滚', '中國搖滾',
  '嘻哈/说唱', 'classical', 'ballad', 'teen pop', 'folk pop', 'dance-pop', 'dance pop',
  'pop soul', 'dream pop', 'alternative folk', 'indie folk', 'indie pop', 'enka',
  'kayōkyoku', 'kayokyoku', 'soundtrack', '原声音乐', 'vgm', 'video game music',
  'video game', 'vocaloid',
]

const EXACT_MAPPINGS = [
  { aliases: ['华语流行', '華語流行', '国语流行', '國語流行', 'mandopop'], code: '01.02', name_zh: '华语流行', name_en: 'C-Pop' },
  { aliases: ['c-pop', 'cpop'], code: '01.02', name_zh: '华语流行', name_en: 'C-Pop' },
  { aliases: ['粤语流行', '粵語流行', 'cantopop'], code: '01.03', name_zh: '粤语流行', name_en: 'Cantopop' },
  { aliases: ['k-pop'], code: '01.04', name_zh: '韩国流行', name_en: 'K-Pop' },
  { aliases: ['j-pop'], code: '01.05', name_zh: '日本流行', name_en: 'J-Pop' },
  { aliases: ['流行', 'pop'], code: '01.01', name_zh: '流行', name_en: 'Pop' },
  { aliases: ['国际流行', 'international pop'], code: '01.01', name_zh: '流行', name_en: 'Pop' },
  { aliases: ['ballad', 'pop ballad', '流行情歌', '抒情流行', '抒情歌曲'], code: '01.07', name_zh: '抒情流行', name_en: 'Pop Ballad' },
  { aliases: ['teen pop'], code: '01.08', name_zh: '青少年流行', name_en: 'Teen Pop' },
  { aliases: ['dance-pop', 'dance pop'], code: '01.09', name_zh: '舞曲流行', name_en: 'Dance-Pop' },
  { aliases: ['indie pop'], code: '01.10', name_zh: '独立流行', name_en: 'Indie Pop' },
  { aliases: ['dream pop'], code: '01.11', name_zh: '梦幻流行', name_en: 'Dream Pop' },
  { aliases: ['kayōkyoku', 'kayokyoku', 'kayoukyoku', '歌謡曲', '歌谣曲'], code: '01.12', name_zh: '日本歌谣曲', name_en: 'Kayokyoku' },
  { aliases: ['民谣', '民謠', 'contemporary folk', 'folk'], code: '04.01', name_zh: '民谣', name_en: 'Folk' },
  { aliases: ['folk pop', 'folk-pop'], code: '04.02', name_zh: '民谣流行', name_en: 'Folk Pop' },
  { aliases: ['alternative folk', 'alt folk'], code: '04.03', name_zh: '另类民谣', name_en: 'Alternative Folk' },
  { aliases: ['indie folk'], code: '04.04', name_zh: '独立民谣', name_en: 'Indie Folk' },
  { aliases: ['说唱', '說唱', '嘻哈', '嘻哈/说唱', '嘻哈/說唱', 'hip hop', 'rap'], code: '05.01', name_zh: '嘻哈/说唱', name_en: 'Hip-Hop / Rap' },
  { aliases: ['trap'], code: '05.06', name_zh: '陷阱说唱', name_en: 'Trap' },
  { aliases: ['pop rap'], code: '05.07', name_zh: '流行说唱', name_en: 'Pop Rap' },
  { aliases: ['中国风', '中國風', '国风', '國風', 'zhongguo feng'], code: '11.04', name_zh: '中国风', name_en: 'Chinese Style' },
  { aliases: ['contemporary r&b'], code: '06.03', name_zh: '当代 R&B', name_en: 'Contemporary R&B' },
  { aliases: ['r&b', '节奏布鲁斯', '節奏藍調'], code: '06.01', name_zh: 'R&B', name_en: 'R&B' },
  { aliases: ['另类摇滚', '另類搖滾', 'alternative rock'], code: '02.03', name_zh: '另类摇滚', name_en: 'Alternative Rock' },
  { aliases: ['流行摇滚', '流行搖滾', 'pop rock', 'pop-rock', 'pop/rock'], code: '02.02', name_zh: '流行摇滚', name_en: 'Pop Rock' },
  { aliases: ['独立摇滚', '獨立搖滾', 'indie rock'], code: '02.12', name_zh: '独立摇滚', name_en: 'Indie Rock' },
  { aliases: ['后摇滚', '後搖滾', 'post-rock'], code: '02.05', name_zh: '后摇', name_en: 'Post-Rock' },
  { aliases: ['油渍摇滚', '油漬搖滾', 'grunge'], code: '02.13', name_zh: '油渍摇滚', name_en: 'Grunge' },
  { aliases: ['硬摇滚', '硬搖滾', 'hard rock'], code: '02.04', name_zh: '硬摇滚', name_en: 'Hard Rock' },
  { aliases: ['硬核', 'hardcore'], code: '02.14', name_zh: '硬核', name_en: 'Hardcore' },
  { aliases: ['说唱金属', '說唱金屬', '饶舌金属', '饒舌金屬', 'rap metal'], code: '02.15', name_zh: '说唱金属', name_en: 'Rap Metal' },
  { aliases: ['摇滚', '搖滾', 'rock', 'hong kong rock band', '中国摇滚', '中國搖滾'], code: '02.01', name_zh: '摇滚', name_en: 'Rock' },
  { aliases: ['电子', '電子', 'electronic'], code: '03.01', name_zh: '电子', name_en: 'Electronic' },
  { aliases: ['舞曲', 'dance'], code: '03.02', name_zh: '舞曲', name_en: 'Dance' },
  { aliases: ['雷鬼', 'reggae'], code: '11.07', name_zh: '雷鬼', name_en: 'Reggae' },
  { aliases: ['乡村', 'country'], code: '10.01', name_zh: '乡村', name_en: 'Country' },
  { aliases: ['古典', 'classical'], code: '08.01', name_zh: '古典', name_en: 'Classical' },
  { aliases: ['soul'], code: '06.02', name_zh: '灵魂乐', name_en: 'Soul' },
  { aliases: ['pop soul'], code: '06.07', name_zh: '流行灵魂乐', name_en: 'Pop Soul' },
  { aliases: ['唱作', 'singer-songwriter'], code: '90.01', name_zh: '唱作', name_en: 'Singer-Songwriter' },
  { aliases: ['独立音乐', '獨立音樂', 'indie music'], code: '90.04', name_zh: '独立音乐', name_en: 'Indie' },
  { aliases: ['enka'], code: '11.12', name_zh: '演歌', name_en: 'Enka' },
  { aliases: ['soundtrack', '原声音乐', 'original soundtrack', 'ost'], code: '12.01', name_zh: '原声', name_en: 'Soundtrack' },
  { aliases: ['vgm', 'video game music', 'video game', 'game music'], code: '12.02', name_zh: '游戏音乐', name_en: 'Video Game Music' },
  { aliases: ['vocaloid', '虚拟歌姬', '虚拟歌手', '虚拟歌声'], code: '90.05', name_zh: '虚拟歌声/Vocaloid', name_en: 'Vocaloid / Virtual Vocal' },
]
let ACTIVE_STYLE_TERMS = [...STYLE_TERMS]
let ACTIVE_EXACT_MAPPING_BY_ALIAS = new Map(EXACT_MAPPINGS.flatMap((m) => m.aliases.map((a) => [a.toLowerCase(), m])))

const AUXILIARY_MAPPINGS = [
  { field: 'language_codes', code: '10', name_zh: '国语/普通话', name_en: 'Mandarin Chinese', aliases: ['mandarin', '国语', '國語', '普通话', '普通話', 'chinese'] },
  { field: 'language_codes', code: '11', name_zh: '粤语', name_en: 'Cantonese', aliases: ['cantonese', '粤语', '粵語'] },
  { field: 'language_codes', code: '13', name_zh: '日语', name_en: 'Japanese', aliases: ['japanese', '日语', '日語'] },
  { field: 'language_codes', code: '14', name_zh: '韩语', name_en: 'Korean', aliases: ['korean', '韩语', '韓語'] },
  { field: 'language_codes', code: '15', name_zh: '英语', name_en: 'English', aliases: ['english', '英语', '英語'] },
  { field: 'region_code', code: '01', name_zh: '中国大陆', name_en: 'Mainland China', aliases: ['mainland china', 'beijing'] },
  { field: 'region_code', code: '02', name_zh: '中国香港', name_en: 'Hong Kong', aliases: ['hong kong', 'hong.kong', '香港'] },
  { field: 'region_code', code: '03', name_zh: '中国台湾', name_en: 'Taiwan', aliases: ['taiwan', 'taiwanese', '台湾', '臺灣'] },
  { field: 'gender_code', code: 'g', name_zh: '组合/乐队', name_en: 'Group / Band', aliases: ['乐队组合', '樂隊組合', '乐队', '樂隊', '组合', '組合', 'band', 'boy band', 'girl group', 'duo', 'group'] },
]

function auxiliaryMatches(rawTag) {
  const tag = String(rawTag || '').toLowerCase()
  return AUXILIARY_MAPPINGS.filter((mapping) => mapping.aliases.some((alias) => tag.includes(alias.toLowerCase())))
}

function parseArgs(argv) {
  const options = {
    input: null,
    output: null,
    summary: null,
    limit: Infinity,
    delayMs: 500,
    musicBrainzDelayMs: 1200,
    wikiLang: 'zh',
    appleCountry: 'CN',
    skipBaidu: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--input') options.input = argv[++i]
    else if (arg === '--output') options.output = argv[++i]
    else if (arg === '--summary') options.summary = argv[++i]
    else if (arg === '--limit') options.limit = Number(argv[++i])
    else if (arg === '--delay-ms') options.delayMs = Number(argv[++i])
    else if (arg === '--musicbrainz-delay-ms') options.musicBrainzDelayMs = Number(argv[++i])
    else if (arg === '--wiki-lang') options.wikiLang = argv[++i]
    else if (arg === '--apple-country') options.appleCountry = argv[++i]
    else if (arg === '--skip-baidu') options.skipBaidu = true
    else if (arg === '--help' || arg === '-h') options.help = true
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return options
}

function usage() {
  console.log([
    'Usage:',
    '  node scripts/tags/run-artist-tag-evidence-batch.mjs --input <sample.json> --output <evidence.jsonl> --summary <summary.json>',
    '',
    'The script appends one JSON object per artist and skips existing artist_key rows on rerun.',
  ].join('\n'))
}

function absolute(file) {
  return path.isAbsolute(file) ? file : path.join(ROOT_DIR, file)
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'))
}

async function writeJson(file, payload) {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(payload, null, 2) + '\n')
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function flattenPlatformAliases(platformAliases) {
  return Object.values(platformAliases || {}).flatMap((value) => Array.isArray(value) ? value : [value])
}

function mappingsFromTaxonomy(taxonomy) {
  return (taxonomy.styles || []).map((style) => {
    const aliases = unique([
      style.standard_style_id,
      style.style_code,
      style.style_code?.replaceAll('_', ' '),
      style.name_zh,
      style.name_en,
      ...(style.aliases || []),
      ...flattenPlatformAliases(style.platform_aliases),
    ])
    return {
      aliases,
      code: style.standard_style_id,
      name_zh: style.name_zh,
      name_en: style.name_en,
    }
  })
}

function activateTaxonomy(taxonomy) {
  const mappings = [...mappingsFromTaxonomy(taxonomy), ...EXACT_MAPPINGS]
  const byCode = new Map()
  for (const mapping of mappings) {
    if (!byCode.has(mapping.code)) byCode.set(mapping.code, { ...mapping, aliases: [] })
    const merged = byCode.get(mapping.code)
    merged.aliases = unique([...merged.aliases, ...(mapping.aliases || [])])
    merged.name_zh ||= mapping.name_zh
    merged.name_en ||= mapping.name_en
  }
  ACTIVE_STYLE_TERMS = unique([...STYLE_TERMS, ...[...byCode.values()].flatMap((mapping) => mapping.aliases)])
  ACTIVE_EXACT_MAPPING_BY_ALIAS = new Map([...byCode.values()].flatMap((mapping) => (
    mapping.aliases.map((alias) => [String(alias || '').trim().toLowerCase(), mapping])
  )))
}

function normalizeName(value) {
  return String(value || '').toLowerCase().replaceAll(/\s|[()（）/._-]/g, '')
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

function extractStyleTerms(text, { allowAmbiguous = false } = {}) {
  const lowerText = String(text || '').toLowerCase()
  const occupied = []
  const hits = []
  for (const term of [...ACTIVE_STYLE_TERMS].sort((a, b) => b.length - a.length)) {
    const searchTerm = term.toLowerCase()
    if (!allowAmbiguous && AMBIGUOUS_FREE_TEXT_TERMS.has(searchTerm)) continue
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
  return unique(hits.sort((a, b) => a.start - b.start).map((h) => h.term))
}

function shortText(text, max = 500) {
  const clean = String(text || '').replaceAll(/\s+/g, ' ').trim()
  return clean.length <= max ? clean : `${clean.slice(0, max)}...`
}

function textWindows(text, terms, max = 4) {
  const clean = String(text || '').replaceAll(/\s+/g, ' ').trim()
  const windows = []
  for (const term of terms) {
    const index = clean.toLowerCase().indexOf(term.toLowerCase())
    if (index < 0) continue
    windows.push(shortText(clean.slice(Math.max(0, index - 45), index + term.length + 65), 160))
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
    if (!response.ok) return { ok: false, status: response.status, elapsed_ms: elapsedMs, error: `HTTP ${response.status}` }
    const body = responseType === 'json' ? await response.json() : await response.text()
    return { ok: true, status: response.status, elapsed_ms: elapsedMs, body }
  } catch (error) {
    return { ok: false, status: null, elapsed_ms: Date.now() - started, error: error.message }
  }
}

async function requestWithRetry(url, options = {}, attempts = 2) {
  const failures = []
  let elapsedMs = 0
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = await request(url, options)
    elapsedMs += result.elapsed_ms
    if (result.ok) return { ...result, elapsed_ms: elapsedMs, attempt_count: attempt, previous_failures: failures }
    failures.push({ attempt, status: result.status, error: result.error })
    if (result.status && result.status !== 429 && result.status < 500) return { ...result, elapsed_ms: elapsedMs, attempt_count: attempt, previous_failures: failures }
    if (attempt < attempts) await sleep(1000 * attempt)
  }
  const last = failures.at(-1)
  return { ok: false, status: last.status, elapsed_ms: elapsedMs, error: last.error, attempt_count: attempts, previous_failures: failures }
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
    aliases: (candidate.aliases || []).map((a) => a.name).slice(0, 5),
    search_tags: (candidate.tags || []).map((t) => t.name),
  }
}

function matchesQueryName(candidate, sample) {
  const accepted = new Set((sample.query_names || [sample.name]).map(normalizeName))
  const names = [candidate.name, ...(candidate.aliases || []).map((a) => a.name)]
  return names.some((name) => accepted.has(normalizeName(name)))
}

let lastMusicBrainzRequestAt = 0
async function musicBrainzRequest(url, delayMs) {
  const waitMs = Math.max(0, delayMs - (Date.now() - lastMusicBrainzRequestAt))
  if (waitMs) await sleep(waitMs)
  const result = await requestWithRetry(url, {}, 2)
  lastMusicBrainzRequestAt = Date.now()
  return result
}

async function fetchMusicBrainz(sample, delayMs) {
  const url = new URL('https://musicbrainz.org/ws/2/artist/')
  url.searchParams.set('query', `artist:"${sample.musicbrainz_query || sample.name}"`)
  url.searchParams.set('fmt', 'json')
  url.searchParams.set('limit', '5')
  const search = await musicBrainzRequest(url, delayMs)
  if (!search.ok) return { source: 'musicbrainz', ...search, raw_tags: [] }
  const candidates = (search.body.artists || []).map(compactCandidate)
  const rawSelected = (search.body.artists || []).find((candidate) => matchesQueryName(candidate, sample))
  if (!rawSelected) return { source: 'musicbrainz', ok: true, status: search.status, elapsed_ms: search.elapsed_ms, match_status: 'needs_review', candidates, raw_tags: [] }

  const detailUrl = new URL(`https://musicbrainz.org/ws/2/artist/${rawSelected.id}`)
  detailUrl.searchParams.set('inc', 'genres+tags+aliases')
  detailUrl.searchParams.set('fmt', 'json')
  const detail = await musicBrainzRequest(detailUrl, delayMs)
  if (!detail.ok) return { source: 'musicbrainz', ...detail, match_status: 'matched_detail_failed', matched_candidate: compactCandidate(rawSelected), candidates, raw_tags: [] }
  const genres = (detail.body.genres || []).map((g) => g.name)
  const tags = (detail.body.tags || []).map((t) => t.name)
  return {
    source: 'musicbrainz',
    ok: true,
    status: detail.status,
    elapsed_ms: search.elapsed_ms + detail.elapsed_ms,
    match_status: 'auto_matched_by_name',
    normalization_eligible: true,
    matched_candidate: compactCandidate(rawSelected),
    candidates,
    genres,
    tags,
    raw_tags: unique([...genres, ...tags]),
  }
}

async function fetchNetease(sample) {
  if (!sample.netease_artist_id) return { source: 'netease_introduction', ok: false, match_status: 'missing_netease_id', raw_tags: [] }
  const result = await request(`https://music.163.com/api/artist/introduction?id=${sample.netease_artist_id}`, {
    headers: { Referer: 'https://music.163.com/' },
  })
  if (!result.ok) return { source: 'netease_introduction', ...result, raw_tags: [] }
  const sections = (result.body.introduction || []).map((p) => p.txt)
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

async function fetchBaiduBaike(sample) {
  const accepted = new Set((sample.query_names || [sample.name]).map(normalizeName))
  for (const queryName of sample.query_names || [sample.name]) {
    let apiResult = null
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const url = new URL('https://baike.baidu.com/api/openapi/BaikeLemmaCardApi')
      url.searchParams.set('scope', '103')
      url.searchParams.set('format', 'json')
      url.searchParams.set('appid', '379020')
      url.searchParams.set('bk_key', queryName)
      url.searchParams.set('bk_length', '1000')
      apiResult = await request(url, { headers: { Referer: 'https://baike.baidu.com/' } })
      if (apiResult.ok && !apiResult.body?.errno) break
      if (attempt < 3) await sleep(800 * attempt)
    }
    if (!apiResult?.ok || apiResult.body?.errno) continue
    const title = apiResult.body.title || apiResult.body.key || ''
    const key = apiResult.body.key || ''
    if (![title, key].some((name) => accepted.has(normalizeName(name)))) continue
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
    const rawTags = unique([
      ...extractStyleTerms(styleCardText, { allowAmbiguous: true }),
      ...extractStyleTerms(apiResult.body.desc || ''),
    ])
    const evidenceText = [apiResult.body.desc, styleCardText].filter(Boolean).join(' ')
    return {
      source: 'baidu_baike',
      ok: true,
      status: apiResult.status,
      elapsed_ms: apiResult.elapsed_ms,
      match_status: 'api_matched_by_title_or_key',
      normalization_eligible: true,
      query_name: queryName,
      lemma_id: apiResult.body.newLemmaId || apiResult.body.subLemmaId || apiResult.body.id || null,
      title,
      key,
      raw_tags: rawTags,
      card_style_terms_for_review: extractStyleTerms(reviewCardText).filter((term) => !rawTags.includes(term)),
      description: shortText(apiResult.body.desc, 300),
      evidence_windows: textWindows(evidenceText, rawTags),
    }
  }
  return { source: 'baidu_baike', ok: false, match_status: 'not_found_or_blocked', raw_tags: [] }
}

async function fetchWikipedia(sample) {
  const wikiLang = sample.wikipedia_lang || sample.wiki_lang || 'zh'
  const sourceName = `wikipedia_${wikiLang}`
  let title = sample.wikipedia_title || sample.name
  const searchUrl = new URL(`https://${wikiLang}.wikipedia.org/w/api.php`)
  searchUrl.searchParams.set('action', 'query')
  searchUrl.searchParams.set('list', 'search')
  searchUrl.searchParams.set('srsearch', sample.wikipedia_query || sample.name)
  searchUrl.searchParams.set('srlimit', '3')
  searchUrl.searchParams.set('format', 'json')
  searchUrl.searchParams.set('origin', '*')
  const search = await requestWithRetry(searchUrl, {}, 2)
  if (search.ok) {
    const accepted = new Set((sample.query_names || [sample.name]).map(normalizeName))
    const hit = (search.body.query?.search || []).find((row) => accepted.has(normalizeName(row.title))) || search.body.query?.search?.[0]
    if (hit?.title) title = hit.title
  }

  const url = new URL(`https://${wikiLang}.wikipedia.org/w/api.php`)
  url.searchParams.set('action', 'query')
  url.searchParams.set('prop', 'revisions')
  url.searchParams.set('titles', title)
  url.searchParams.set('rvprop', 'content')
  url.searchParams.set('rvslots', 'main')
  url.searchParams.set('formatversion', '2')
  url.searchParams.set('format', 'json')
  url.searchParams.set('origin', '*')
  const result = await requestWithRetry(url, {}, 2)
  if (!result.ok) return { source: sourceName, ...result, raw_tags: [] }
  const page = result.body.query?.pages?.[0]
  if (!page || page.missing) return { source: sourceName, ok: true, status: result.status, elapsed_ms: result.elapsed_ms, match_status: 'not_found', raw_tags: [] }
  const text = page.revisions?.[0]?.slots?.main?.content || ''
  const lines = text.split('\n')
  const genreLines = []
  const start = lines.findIndex((line) => /^\s*\|\s*(音乐类型|音樂類型|genre|曲风|曲風)\s*=/i.test(line))
  if (start >= 0) {
    genreLines.push(lines[start])
    if (lines[start].includes('{{')) {
      for (const line of lines.slice(start + 1, start + 12)) {
        if (/^\s*\|\s*[^*]/.test(line)) break
        genreLines.push(line)
        if (line.includes('}}')) break
      }
    }
  }
  const evidenceText = genreLines.length ? genreLines.join(' ') : text.slice(0, 4000)
  return {
    source: sourceName,
    ok: true,
    status: result.status,
    elapsed_ms: (search.elapsed_ms || 0) + result.elapsed_ms,
    match_status: 'matched_by_search_or_title',
    normalization_eligible: true,
    page_title: page.title,
    raw_tags: extractStyleTerms(evidenceText, { allowAmbiguous: genreLines.length > 0 }),
    evidence_lines: genreLines.map((line) => shortText(line, 240)),
  }
}

async function fetchApple(sample, country = 'CN') {
  const accepted = new Set((sample.query_names || [sample.name]).map(normalizeName))
  const queryNames = unique(sample.query_names || [sample.name]).slice(0, 6)
  const attempts = []
  for (const queryName of queryNames) {
    const url = new URL('https://itunes.apple.com/search')
    url.searchParams.set('term', queryName)
    url.searchParams.set('media', 'music')
    url.searchParams.set('entity', 'musicArtist')
    url.searchParams.set('country', country)
    url.searchParams.set('limit', '10')
    const result = await request(url)
    if (!result.ok) return { source: 'apple_search', ...result, raw_tags: [] }
    const candidates = (result.body.results || []).map((c) => ({
      artist_id: c.artistId,
      artist_name: c.artistName,
      primary_genre_name: c.primaryGenreName || null,
      artist_link_url: c.artistLinkUrl || null,
    }))
    attempts.push({ query_name: queryName, elapsed_ms: result.elapsed_ms, candidates: candidates.slice(0, 5) })
    const matches = candidates.filter((c) => accepted.has(normalizeName(c.artist_name)))
    const match = matches.length === 1 ? matches[0] : null
    if (match) {
      return {
        source: 'apple_search',
        ok: true,
        status: result.status,
        elapsed_ms: attempts.reduce((sum, attempt) => sum + attempt.elapsed_ms, 0),
        match_status: 'auto_matched_by_unique_exact_alias',
        normalization_eligible: true,
        query_name: queryName,
        matched_candidate: match,
        candidates: candidates.slice(0, 5),
        query_attempts: attempts,
        raw_tags: match.primary_genre_name ? [match.primary_genre_name] : [],
      }
    }
  }
  return {
    source: 'apple_search',
    ok: true,
    status: 200,
    elapsed_ms: attempts.reduce((sum, attempt) => sum + attempt.elapsed_ms, 0),
    match_status: 'needs_identity_review',
    normalization_eligible: false,
    matched_candidate: null,
    candidates: attempts[0]?.candidates || [],
    query_attempts: attempts,
    raw_tags: [],
  }
}

function deriveNormalizedCandidates(sources) {
  const byCode = new Map()
  for (const source of sources) {
    if (source.normalization_eligible === false) continue
    for (const rawTag of source.raw_tags || []) {
      const mapping = ACTIVE_EXACT_MAPPING_BY_ALIAS.get(rawTag.toLowerCase())
      if (!mapping) continue
      if (!byCode.has(mapping.code)) {
        byCode.set(mapping.code, { style_code: mapping.code, name_zh: mapping.name_zh, name_en: mapping.name_en, evidence: [] })
      }
      byCode.get(mapping.code).evidence.push({ source: source.source, raw_tag: rawTag })
    }
  }
  return [...byCode.values()].map((entry) => ({
    ...entry,
    evidence: unique(entry.evidence.map((e) => JSON.stringify(e))).map((e) => JSON.parse(e)),
  }))
}

function deriveAuxiliaryCandidates(sources) {
  const result = {
    gender_code: null,
    region_code: null,
    language_codes: [],
    evidence: [],
  }
  for (const source of sources) {
    if (source.normalization_eligible === false) continue
    for (const rawTag of source.raw_tags || []) {
      for (const mapping of auxiliaryMatches(rawTag)) {
        if (mapping.field === 'gender_code' && !result.gender_code) result.gender_code = mapping.code
        else if (mapping.field === 'region_code' && !result.region_code) result.region_code = mapping.code
        else if (mapping.field === 'language_codes' && !result.language_codes.includes(mapping.code)) result.language_codes.push(mapping.code)
        result.evidence.push({
          source: source.source,
          raw_tag: rawTag,
          field: mapping.field,
          code: mapping.code,
          name_zh: mapping.name_zh,
          name_en: mapping.name_en,
        })
      }
    }
  }
  return {
    ...result,
    evidence: unique(result.evidence.map((e) => JSON.stringify(e))).map((e) => JSON.parse(e)),
  }
}

async function readCompletedKeys(outputFile) {
  if (!existsSync(outputFile)) return new Set()
  const text = await readFile(outputFile, 'utf8')
  return new Set(text.split('\n').filter(Boolean).map((line) => {
    try {
      const row = JSON.parse(line)
      return row.error ? null : row.artist_key
    } catch {
      return null
    }
  }).filter(Boolean))
}

async function processArtist(sample, options) {
  const sources = [
    {
      source: 'qq_original_readable_tags',
      ok: true,
      match_status: 'from_sample',
      normalization_eligible: true,
      raw_tags: sample.qq_readable_tags || [],
    },
    {
      source: 'qq_v8_raw_numeric_tags',
      ok: true,
      match_status: 'from_sample',
      normalization_eligible: false,
      raw_tag_ids: sample.qq_v8_raw_tag_ids || [],
      raw_tags: [],
    },
  ]
  sources.push(await fetchNetease(sample))
  await sleep(options.delayMs)
  if (!options.skipBaidu) {
    sources.push(await fetchBaiduBaike(sample))
    await sleep(options.delayMs)
  }
  sources.push(await fetchMusicBrainz(sample, options.musicBrainzDelayMs))
  await sleep(options.delayMs)
  sources.push(await fetchWikipedia({ ...sample, wiki_lang: options.wikiLang }))
  await sleep(options.delayMs)
  sources.push(await fetchApple(sample, options.appleCountry))

  const normalized = deriveNormalizedCandidates(sources)
  const auxiliary = deriveAuxiliaryCandidates(sources)
  return {
    artist_key: sample.artist_key,
    research_identity: {
      requested_name: sample.name,
      query_names: sample.query_names || [sample.name],
      qq_artist_id: sample.qq_artist_id || null,
      netease_artist_id: sample.netease_artist_id || null,
    },
    sources,
    normalized_candidates_preview: normalized,
    normalized_auxiliary_preview: auxiliary,
    unmatched_raw_style_terms: unique(
      sources.flatMap((source) => source.raw_tags || []).filter((tag) => {
        const lowerTag = tag.toLowerCase()
        return !ACTIVE_EXACT_MAPPING_BY_ALIAS.has(lowerTag) && auxiliaryMatches(lowerTag).length === 0
      }),
    ),
    processed_at: new Date().toISOString(),
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help || !options.input || !options.output || !options.summary) {
    usage()
    if (!options.help) throw new Error('Missing required arguments')
    return
  }
  options.input = absolute(options.input)
  options.output = absolute(options.output)
  options.summary = absolute(options.summary)
  const taxonomy = await readJson(TAXONOMY_FILE)
  activateTaxonomy(taxonomy)
  await mkdir(path.dirname(options.output), { recursive: true })
  await mkdir(path.dirname(options.summary), { recursive: true })

  const input = await readJson(options.input)
  const artists = (input.items || input.artists || []).slice(0, options.limit)
  const completed = await readCompletedKeys(options.output)
  const startedAt = Date.now()
  const stats = { input_count: artists.length, skipped_existing: 0, processed: 0, failed: 0 }

  for (let index = 0; index < artists.length; index += 1) {
    const sample = artists[index]
    if (completed.has(sample.artist_key)) {
      stats.skipped_existing += 1
      continue
    }
    try {
      const result = await processArtist(sample, options)
      await appendFile(options.output, JSON.stringify(result) + '\n')
      completed.add(sample.artist_key)
      stats.processed += 1
      console.log(`[${index + 1}/${artists.length}] ok ${sample.name} ${sample.artist_key} tags=${result.normalized_candidates_preview.map((x) => x.style_code).join(',')}`)
    } catch (error) {
      stats.failed += 1
      const failed = { artist_key: sample.artist_key, name: sample.name, error: error.message, processed_at: new Date().toISOString() }
      await appendFile(options.output, JSON.stringify(failed) + '\n')
      console.log(`[${index + 1}/${artists.length}] failed ${sample.name}: ${error.message}`)
    }
  }

  await writeJson(options.summary, {
    generated_at: new Date().toISOString(),
    input_file: path.relative(ROOT_DIR, options.input).replaceAll(path.sep, '/'),
    output_file: path.relative(ROOT_DIR, options.output).replaceAll(path.sep, '/'),
    stats: {
      ...stats,
      elapsed_ms: Date.now() - startedAt,
      elapsed_seconds: Number(((Date.now() - startedAt) / 1000).toFixed(3)),
      total_completed_keys: completed.size,
    },
  })
}

await main()
