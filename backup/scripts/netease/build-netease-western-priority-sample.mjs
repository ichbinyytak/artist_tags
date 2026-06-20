import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.dirname(path.dirname(SCRIPT_DIR))

function parseArgs(argv) {
  const options = {
    input: 'temp1/tag-source-research/netease-pending-samples/netease-pending-western-tag-run.sample.json',
    output: 'temp1/tag-source-research/netease-western-priority/netease-western-priority-tag-run.sample.json',
    reviewOutput: 'temp1/tag-source-research/netease-western-priority/netease-western-priority-review.json',
    deferOutput: 'temp1/tag-source-research/netease-western-priority/netease-western-deferred-non-artist-review.json',
    fanThreshold: 10000,
    highSongThreshold: 10000,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--input') options.input = argv[++i]
    else if (arg === '--output') options.output = argv[++i]
    else if (arg === '--review-output') options.reviewOutput = argv[++i]
    else if (arg === '--defer-output') options.deferOutput = argv[++i]
    else if (arg === '--fan-threshold') options.fanThreshold = Number(argv[++i])
    else if (arg === '--high-song-threshold') options.highSongThreshold = Number(argv[++i])
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

async function writeJson(file, payload) {
  const target = absolute(file)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, JSON.stringify(payload, null, 2) + '\n')
}

function scoreOf(item) {
  const ctx = item.ranking_context || {}
  return Number(ctx.netease_fan_count || 0) +
    Number(ctx.netease_song_count || 0) * 100 +
    Number(ctx.netease_album_count || 0) * 20
}

function fanCount(item) {
  return Number(item.ranking_context?.netease_fan_count || 0)
}

function songCount(item) {
  return Number(item.ranking_context?.netease_song_count || 0)
}

function albumCount(item) {
  return Number(item.ranking_context?.netease_album_count || 0)
}

function addReason(reasons, reason) {
  if (!reasons.includes(reason)) reasons.push(reason)
}

function classifyName(name) {
  const value = String(name || '')
  const lower = value.toLowerCase()
  const categories = []

  if (/^(various artists|群星)$/i.test(value)) addReason(categories, 'various_artists')
  if (/relax|sleep|yoga|meditation|healing|calm|spa|massage|reiki|peaceful|zen|soothing|tranquil|therapy|lullaby|study music|workout music|musica para dormir/i.test(value)) addReason(categories, 'functional_relax_sleep_yoga')
  if (/nature|rain|ocean|wave|water|thunder|storm|forest|bird|wind|white noise|brown noise|pink noise|sounds?|ambience|ambient sounds|sound effects|hollywood edge|outside broadcast/i.test(value)) addReason(categories, 'nature_noise_sound_effect')
  if (/karaoke|tribute|backing track|instrumental version|piano tribute|string quartet tribute/i.test(value)) addReason(categories, 'karaoke_cover_tribute')
  if (/bgm|music library|production music|fm star|all bgm|channel project|piano dreamers|piano crew|new york jazz lounge|jazz lounge|vee sing zone|bobby cole|eximo blue/i.test(value)) addReason(categories, 'generic_bgm_library')
  if (/bach|mozart|beethoven|chopin|tchaikovsky|schubert|debussy|schumann|vivaldi|handel|brahms|mahler|liszt|rachmaninoff|ravel|stravinsky|karajan|bernstein|abbado|ashkenazy|marriner|orchestra|symphony|philharmonic|choir|ensemble|quartet|opera|chamber|academy of st\. martin/i.test(value)) addReason(categories, 'classical_composer_performer')
  if (/nursery rhymes|songs for children|rockabye baby|toktok kids|karaoke kids/i.test(value)) addReason(categories, 'kids_education_catalog')
  if (/christmas|holiday|xmas/i.test(value) && !/molly santana/i.test(lower)) addReason(categories, 'holiday_catalog')

  if (/blackpink|i-dle|yoasob(i|i。)|hoyo-mix|jony j|tizzyt|higher brothers|ice paper|capper|knowknow|psy\.p|thome|kbshinya|king gnu|ive|stray kids/i.test(value)) addReason(categories, 'likely_cjk_latin_name')

  return categories
}

function isHardDeferred(categories) {
  return categories.some((category) => [
    'various_artists',
    'functional_relax_sleep_yoga',
    'nature_noise_sound_effect',
    'karaoke_cover_tribute',
    'generic_bgm_library',
    'kids_education_catalog',
    'holiday_catalog',
  ].includes(category))
}

function shouldInclude(item, categories, options) {
  if (isHardDeferred(categories)) return false
  if (fanCount(item) >= options.fanThreshold) return true
  if (item.netease_pending_reason === 'qq_overlap_conflict_deferred') return true
  if (item.netease_pending_reason === 'qq_overlap_without_style') return true
  if (songCount(item) >= options.highSongThreshold) return true
  return false
}

function compactItem(item, categories, decision) {
  return {
    artist_key: item.artist_key,
    name: item.name,
    decision,
    categories,
    pending_reason: item.netease_pending_reason,
    fan_count: item.ranking_context?.netease_fan_count ?? null,
    song_count: item.ranking_context?.netease_song_count ?? null,
    album_count: item.ranking_context?.netease_album_count ?? null,
    score: scoreOf(item),
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const input = await readJson(options.input)
  const rows = input.items || []
  const priority = []
  const deferred = []
  const review = []
  const categoryCounts = {}

  for (const item of rows) {
    const categories = classifyName(item.name)
    const decision = shouldInclude(item, categories, options) ? 'priority_run' : 'defer'
    for (const category of categories.length ? categories : ['uncategorized']) {
      categoryCounts[category] = (categoryCounts[category] || 0) + 1
    }
    review.push(compactItem(item, categories, decision))
    if (decision === 'priority_run') priority.push(item)
    else deferred.push(compactItem(item, categories, decision))
  }

  priority.sort((a, b) => scoreOf(b) - scoreOf(a))
  deferred.sort((a, b) => b.score - a.score)
  review.sort((a, b) => b.score - a.score)

  await writeJson(options.output, {
    generated_at: new Date().toISOString(),
    description: 'High-value NetEase western pending artists selected after filtering obvious non-artist/catalog accounts.',
    selection: {
      source_file: options.input,
      fan_threshold: options.fanThreshold,
      high_song_threshold: options.highSongThreshold,
      include_reasons: [
        `netease_fan_count >= ${options.fanThreshold}`,
        'qq_overlap_conflict_deferred',
        'qq_overlap_without_style',
        `netease_song_count >= ${options.highSongThreshold} when not an obvious catalog account`,
      ],
      excluded_categories: [
        'various_artists',
        'functional_relax_sleep_yoga',
        'nature_noise_sound_effect',
        'karaoke_cover_tribute',
        'generic_bgm_library',
        'kids_education_catalog',
        'holiday_catalog',
      ],
      suggested_wiki_lang: 'en',
      suggested_apple_country: 'US',
    },
    stats: {
      source_count: rows.length,
      item_count: priority.length,
      deferred_count: deferred.length,
      category_counts: categoryCounts,
    },
    items: priority,
  })

  await writeJson(options.reviewOutput, {
    generated_at: new Date().toISOString(),
    source_file: options.input,
    priority_output: options.output,
    defer_output: options.deferOutput,
    stats: {
      source_count: rows.length,
      priority_count: priority.length,
      deferred_count: deferred.length,
      category_counts: categoryCounts,
    },
    items: review,
  })

  await writeJson(options.deferOutput, {
    generated_at: new Date().toISOString(),
    description: 'NetEase western pending rows deferred as obvious non-artist/catalog/low-value accounts.',
    source_file: options.input,
    stats: {
      item_count: deferred.length,
      category_counts: categoryCounts,
    },
    items: deferred,
  })

  console.log(JSON.stringify({
    source_count: rows.length,
    priority_count: priority.length,
    deferred_count: deferred.length,
    output: options.output,
    review_output: options.reviewOutput,
    defer_output: options.deferOutput,
    category_counts: categoryCounts,
  }, null, 2))
}

await main()
