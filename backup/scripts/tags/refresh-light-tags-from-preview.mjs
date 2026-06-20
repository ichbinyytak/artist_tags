import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.dirname(path.dirname(SCRIPT_DIR))
const TAXONOMY_FILE = path.join(ROOT_DIR, 'data/platform-source/qq/v8/dictionaries/standard-style-taxonomy.json')

const SUPPLEMENTAL_STYLE_MAPPINGS = [
  { aliases: ['唱作', 'singer-songwriter', 'singer/songwriter', 'Contemporary Singer/Songwriter', '唱作歌手', 'songwriter', '原创音乐', 'シンガーソングライター', '싱어송라이터'], code: '90.01', name_zh: '唱作', name_en: 'Singer-Songwriter' },
  { aliases: ['儿童音乐', '儿童音樂', 'children', "children's music", '摇篮曲', 'チルドレン・ミュージック', 'キッズ／ファミリー', '어린이 음악', '어린이 및 청소년'], code: '90.02', name_zh: '儿歌', name_en: "Children's Music" },
  { aliases: ['独立音乐', '獨立音樂', 'indie music', 'indie', '한국 인디'], code: '90.04', name_zh: '独立音乐', name_en: 'Indie' },
  { aliases: ['vocaloid', '虚拟歌姬', '虚拟歌手', '虚拟歌声'], code: '90.05', name_zh: '虚拟歌声/Vocaloid', name_en: 'Vocaloid / Virtual Vocal' },
]

function parseArgs(argv) {
  const options = {
    input: null,
    output: null,
    previewOutput: null,
    reviewOutput: null,
    sample: null,
    qqRawMap: null,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--input') options.input = argv[++i]
    else if (arg === '--output') options.output = argv[++i]
    else if (arg === '--preview-output') options.previewOutput = argv[++i]
    else if (arg === '--review-output') options.reviewOutput = argv[++i]
    else if (arg === '--sample') options.sample = argv[++i]
    else if (arg === '--qq-raw-map') options.qqRawMap = argv[++i]
    else throw new Error(`Unknown argument: ${arg}`)
  }
  if (!options.input || !options.output) {
    throw new Error('Usage: node scripts/tags/refresh-light-tags-from-preview.mjs --input <light-preview.json> --output <formal-light.json> [--preview-output <updated-preview.json>] [--review-output <review.json>] [--sample <sample.json>]')
  }
  return options
}

function absolute(file) {
  return path.isAbsolute(file) ? file : path.join(ROOT_DIR, file)
}

function relative(file) {
  return path.relative(ROOT_DIR, absolute(file)).replaceAll(path.sep, '/')
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function normalizeAlias(value) {
  return String(value || '').trim().toLowerCase()
}

function flattenPlatformAliases(platformAliases) {
  return Object.values(platformAliases || {}).flatMap((value) => Array.isArray(value) ? value : [value])
}

function taxonomyAliasMap(taxonomy) {
  const aliasMap = new Map()
  for (const style of taxonomy.styles || []) {
    const aliases = unique([
      style.standard_style_id,
      style.style_code,
      style.style_code?.replaceAll('_', ' '),
      style.name_zh,
      style.name_en,
      ...(style.aliases || []),
      ...flattenPlatformAliases(style.platform_aliases),
    ])
    for (const alias of aliases) aliasMap.set(normalizeAlias(alias), style)
  }
  for (const mapping of SUPPLEMENTAL_STYLE_MAPPINGS) {
    for (const alias of mapping.aliases || []) {
      aliasMap.set(normalizeAlias(alias), {
        standard_style_id: mapping.code,
        name_zh: mapping.name_zh,
        name_en: mapping.name_en,
      })
    }
  }
  return aliasMap
}

function legendFromTaxonomy(inputLegend, taxonomy, items) {
  const usedStyleCodes = new Set(items.flatMap((item) => item.style_codes || []))
  const taxonomyStyles = (taxonomy.styles || []).map((style) => ({
    code: style.standard_style_id,
    name_zh: style.name_zh,
    name_en: style.name_en,
  }))
  const supplementalStyles = SUPPLEMENTAL_STYLE_MAPPINGS.map((style) => ({
    code: style.code,
    name_zh: style.name_zh,
    name_en: style.name_en,
  }))
  const inputStyles = inputLegend?.style_codes || []
  const stylesByCode = new Map([...taxonomyStyles, ...supplementalStyles, ...inputStyles].map((style) => [style.code, style]))
  return {
    gender_codes: inputLegend?.gender_codes || [
      { code: 'm', name_zh: '男', name_en: 'Male' },
      { code: 'f', name_zh: '女', name_en: 'Female' },
      { code: 'g', name_zh: '组合/乐队', name_en: 'Group / Band' },
      { code: 'u', name_zh: '未知', name_en: 'Unknown' },
    ],
    region_codes: inputLegend?.region_codes || [],
    language_codes: inputLegend?.language_codes || [],
    style_codes: [...stylesByCode.values()].filter((style) => usedStyleCodes.has(style.code)),
  }
}

function sampleByKey(samplePayload) {
  return new Map((samplePayload?.items || samplePayload?.artists || []).map((item) => [item.artist_key, item]))
}

function qqRawMapById(payload) {
  return new Map((payload?.entries || [])
    .filter((entry) => ['supported_draft', 'provisional_draft'].includes(entry.mapping_status))
    .filter((entry) => !entry.crosscheck_conflict)
    .filter((entry) => entry.proposed_standard_tag?.standard_id)
    .map((entry) => [String(entry.raw_tag_id), entry.proposed_standard_tag.standard_id]))
}

function reviewReport(items, sampleMap, sourceFile) {
  const termCounts = new Map()
  const noStyleSamples = []
  for (const item of items) {
    for (const term of item.review_unmatched_raw_terms || []) {
      termCounts.set(term, (termCounts.get(term) || 0) + 1)
    }
    if ((item.style_codes || []).length === 0 && noStyleSamples.length < 100) {
      const sample = sampleMap.get(item.artist_key)
      noStyleSamples.push({
        artist_key: item.artist_key,
        name: sample?.name || null,
        qq_v8_context: sample?.qq_v8_context || null,
        netease_artist_id: sample?.netease_artist_id || null,
        qq_v8_raw_tag_ids: sample?.qq_v8_raw_tag_ids || [],
      })
    }
  }
  return {
    generated_at: new Date().toISOString(),
    source_file: sourceFile,
    stats: {
      rows_with_review_unmatched_terms: items.filter((item) => (item.review_unmatched_raw_terms || []).length).length,
      unique_unmatched_terms: termCounts.size,
      rows_without_style_codes: items.filter((item) => (item.style_codes || []).length === 0).length,
    },
    top_unmatched_terms: [...termCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([term, count]) => ({ term, count })),
    no_style_samples: noStyleSamples,
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const source = JSON.parse(await readFile(absolute(options.input), 'utf8'))
  const taxonomy = JSON.parse(await readFile(TAXONOMY_FILE, 'utf8'))
  const aliasMap = taxonomyAliasMap(taxonomy)
  const sample = options.sample ? JSON.parse(await readFile(absolute(options.sample), 'utf8')) : null
  const samples = sampleByKey(sample)
  const qqRawMapPayload = options.qqRawMap ? JSON.parse(await readFile(absolute(options.qqRawMap), 'utf8')) : null
  const qqRawStyles = qqRawMapById(qqRawMapPayload)

  let rowsEnriched = 0
  let styleCodesAdded = 0
  let rowsFilledByQqRawMap = 0
  let styleCodesAddedFromQqRawMap = 0
  const previewItems = (source.items || []).map((item) => {
    const styleCodes = new Set(item.style_codes || [])
    const remainingTerms = []
    let enriched = false
    for (const term of item.review_unmatched_raw_terms || []) {
      const style = aliasMap.get(normalizeAlias(term))
      if (style) {
        if (!styleCodes.has(style.standard_style_id)) {
          styleCodes.add(style.standard_style_id)
          styleCodesAdded += 1
          enriched = true
        }
      } else {
        remainingTerms.push(term)
      }
    }
    if (enriched) rowsEnriched += 1
    if (styleCodes.size === 0 && qqRawStyles.size) {
      const sampleItem = samples.get(item.artist_key)
      let rawFilled = false
      for (const rawTagId of sampleItem?.qq_v8_raw_tag_ids || []) {
        const styleCode = qqRawStyles.get(String(rawTagId))
        if (styleCode && !styleCodes.has(styleCode)) {
          styleCodes.add(styleCode)
          styleCodesAddedFromQqRawMap += 1
          rawFilled = true
        }
      }
      if (rawFilled) rowsFilledByQqRawMap += 1
    }
    return {
      ...item,
      style_codes: [...styleCodes],
      review_unmatched_raw_terms: unique(remainingTerms),
    }
  })

  const stats = {
    item_count: previewItems.length,
    rows_without_style_codes: previewItems.filter((item) => (item.style_codes || []).length === 0).length,
    rows_with_review_unmatched_terms: previewItems.filter((item) => (item.review_unmatched_raw_terms || []).length).length,
    rows_with_unknown_region: previewItems.filter((item) => item.region_code === '07').length,
    rows_without_language_codes: previewItems.filter((item) => !(item.language_codes || []).length).length,
    rows_with_unknown_gender: previewItems.filter((item) => item.gender_code === 'u').length,
    rows_enriched_from_review_terms: rowsEnriched,
    style_codes_added_from_review_terms: styleCodesAdded,
    rows_filled_by_qq_raw_map_this_run: rowsFilledByQqRawMap,
    style_codes_added_from_qq_raw_map_this_run: styleCodesAddedFromQqRawMap,
    rows_filled_by_supported_qq_raw_tags: source.stats?.rows_filled_by_supported_qq_raw_tags || 0,
  }

  const common = {
    version: 3,
    generated_at: new Date().toISOString(),
    source_files: {
      previous_preview: relative(options.input),
      taxonomy: relative(TAXONOMY_FILE),
      sample: options.sample ? relative(options.sample) : null,
      qq_raw_map: options.qqRawMap ? relative(options.qqRawMap) : null,
    },
    code_legend: legendFromTaxonomy(source.code_legend, taxonomy, previewItems),
    stats,
  }

  if (options.previewOutput) {
    const previewPayload = {
      ...source,
      ...common,
      status: 'light_preview_refreshed_from_taxonomy',
      description: 'Compact light tag preview refreshed from the latest database taxonomy. Names and source evidence are intentionally omitted.',
      items: previewItems,
    }
    await mkdir(path.dirname(absolute(options.previewOutput)), { recursive: true })
    await writeFile(absolute(options.previewOutput), JSON.stringify(previewPayload, null, 2) + '\n')
  }

  const formalPayload = {
    ...common,
    status: 'formal_light_tags',
    description: 'Compact artist tag table. Names and source evidence are intentionally omitted; use artist_key to join artist metadata tables.',
    items: previewItems.map(({ review_unmatched_raw_terms, ...item }) => item),
  }
  await mkdir(path.dirname(absolute(options.output)), { recursive: true })
  await writeFile(absolute(options.output), JSON.stringify(formalPayload, null, 2) + '\n')

  if (options.reviewOutput) {
    const report = reviewReport(previewItems, samples, relative(options.input))
    await mkdir(path.dirname(absolute(options.reviewOutput)), { recursive: true })
    await writeFile(absolute(options.reviewOutput), JSON.stringify(report, null, 2) + '\n')
  }

  console.log(`Wrote ${previewItems.length} rows to ${relative(options.output)}`)
  console.log(JSON.stringify(stats, null, 2))
}

await main()
