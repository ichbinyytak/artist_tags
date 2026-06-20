import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.dirname(path.dirname(SCRIPT_DIR))
const TAXONOMY_FILE = path.join(ROOT_DIR, 'data/platform-source/qq/v8/dictionaries/standard-style-taxonomy.json')

const SUPPLEMENTAL_STYLE_MAPPINGS = [
  { aliases: ['华语流行', '華語流行', '国语流行', '國語流行', 'mandopop', 'c-pop', 'cpop'], code: '01.02', name_zh: '华语流行', name_en: 'C-Pop' },
  { aliases: ['粤语流行', '粵語流行', 'cantopop'], code: '01.03', name_zh: '粤语流行', name_en: 'Cantopop' },
  { aliases: ['k-pop'], code: '01.04', name_zh: '韩国流行', name_en: 'K-Pop' },
  { aliases: ['j-pop'], code: '01.05', name_zh: '日本流行', name_en: 'J-Pop' },
  { aliases: ['流行', 'pop', '国际流行', 'international pop'], code: '01.01', name_zh: '流行', name_en: 'Pop' },
  { aliases: ['shidaiqu', '时代曲', '時代曲'], code: '01.13', name_zh: '时代曲', name_en: 'Shidaiqu' },
  { aliases: ['hokkien pop', '闽南语流行', '閩南語流行'], code: '01.14', name_zh: '闽南语流行', name_en: 'Hokkien Pop' },
  { aliases: ['ballad', 'pop ballad', '流行情歌', '抒情流行', '抒情歌曲'], code: '01.07', name_zh: '抒情流行', name_en: 'Pop Ballad' },
  { aliases: ['teen pop'], code: '01.08', name_zh: '青少年流行', name_en: 'Teen Pop' },
  { aliases: ['dance-pop', 'dance pop'], code: '01.09', name_zh: '舞曲流行', name_en: 'Dance-Pop' },
  { aliases: ['indie pop', '独立流行', '獨立流行'], code: '01.10', name_zh: '独立流行', name_en: 'Indie Pop' },
  { aliases: ['dream pop'], code: '01.11', name_zh: '梦幻流行', name_en: 'Dream Pop' },
  { aliases: ['kayōkyoku', 'kayokyoku', 'kayoukyoku', '歌謡曲', '歌谣曲'], code: '01.12', name_zh: '日本歌谣曲', name_en: 'Kayokyoku' },
  { aliases: ['摇滚', '搖滾', 'rock', 'hong kong rock band', '中国摇滚', '中國搖滾'], code: '02.01', name_zh: '摇滚', name_en: 'Rock' },
  { aliases: ['流行摇滚', '流行搖滾', 'pop rock', 'pop-rock', 'pop/rock'], code: '02.02', name_zh: '流行摇滚', name_en: 'Pop Rock' },
  { aliases: ['另类摇滚', '另類搖滾', 'alternative rock', '另类音乐', '另类', '华语另类音乐'], code: '02.03', name_zh: '另类摇滚', name_en: 'Alternative Rock' },
  { aliases: ['硬摇滚', '硬搖滾', 'hard rock'], code: '02.04', name_zh: '硬摇滚', name_en: 'Hard Rock' },
  { aliases: ['后摇滚', '後搖滾', 'post-rock'], code: '02.05', name_zh: '后摇', name_en: 'Post-Rock' },
  { aliases: ['金属', '金屬', 'metal', 'heavy metal', 'black metal'], code: '02.06', name_zh: '金属', name_en: 'Metal' },
  { aliases: ['punk', 'punk rock', '朋克', '朋克摇滚'], code: '02.07', name_zh: '朋克', name_en: 'Punk' },
  { aliases: ['progressive rock', 'prog rock', 'art rock'], code: '02.08', name_zh: '前卫摇滚', name_en: 'Progressive Rock' },
  { aliases: ['独立摇滚', '獨立搖滾', 'indie rock'], code: '02.12', name_zh: '独立摇滚', name_en: 'Indie Rock' },
  { aliases: ['油渍摇滚', '油漬搖滾', 'grunge'], code: '02.13', name_zh: '油渍摇滚', name_en: 'Grunge' },
  { aliases: ['硬核', 'hardcore'], code: '02.14', name_zh: '硬核', name_en: 'Hardcore' },
  { aliases: ['说唱金属', '說唱金屬', '饶舌金属', '饒舌金屬', 'rap metal'], code: '02.15', name_zh: '说唱金属', name_en: 'Rap Metal' },
  { aliases: ['民谣摇滚', '民謠搖滾', 'folk rock'], code: '02.16', name_zh: '民谣摇滚', name_en: 'Folk Rock' },
  { aliases: ['电子', '電子', 'electronic', '电子音乐', '電子音樂'], code: '03.01', name_zh: '电子', name_en: 'Electronic' },
  { aliases: ['舞曲', 'dance'], code: '03.02', name_zh: '舞曲', name_en: 'Dance' },
  { aliases: ['ambient', '氛围电子', '氛围音乐'], code: '03.03', name_zh: '氛围电子', name_en: 'Ambient' },
  { aliases: ['synth-pop', 'synth pop', '合成器流行'], code: '03.09', name_zh: '合成器流行', name_en: 'Synth-Pop' },
  { aliases: ['electronica'], code: '03.10', name_zh: '电子乐', name_en: 'Electronica' },
  { aliases: ['edm'], code: '03.11', name_zh: '电子舞曲', name_en: 'EDM' },
  { aliases: ['techno'], code: '03.12', name_zh: '科技舞曲', name_en: 'Techno' },
  { aliases: ['house', 'House 作品'], code: '03.13', name_zh: '浩室', name_en: 'House' },
  { aliases: ['drum and bass', 'drum & bass'], code: '03.14', name_zh: '鼓打贝斯', name_en: 'Drum and Bass' },
  { aliases: ['民谣', '民謠', 'contemporary folk', 'folk'], code: '04.01', name_zh: '民谣', name_en: 'Folk' },
  { aliases: ['folk pop', 'folk-pop'], code: '04.02', name_zh: '民谣流行', name_en: 'Folk Pop' },
  { aliases: ['alternative folk', 'alt folk'], code: '04.03', name_zh: '另类民谣', name_en: 'Alternative Folk' },
  { aliases: ['indie folk'], code: '04.04', name_zh: '独立民谣', name_en: 'Indie Folk' },
  { aliases: ['campus folk', '校园民谣', '校園民謠'], code: '04.05', name_zh: '校园民谣', name_en: 'Campus Folk' },
  { aliases: ['说唱', '說唱', '嘻哈', '嘻哈/说唱', '嘻哈/說唱', 'hip hop', 'hip-hop', 'Hip-Hop', 'rap', '中文嘻哈'], code: '05.01', name_zh: '嘻哈/说唱', name_en: 'Hip-Hop / Rap' },
  { aliases: ['trap'], code: '05.06', name_zh: '陷阱说唱', name_en: 'Trap' },
  { aliases: ['pop rap'], code: '05.07', name_zh: '流行说唱', name_en: 'Pop Rap' },
  { aliases: ['r&b', '节奏布鲁斯', '節奏藍調'], code: '06.01', name_zh: 'R&B', name_en: 'R&B' },
  { aliases: ['R&B/灵魂乐'], code: '06.00', name_zh: 'R&B/灵魂乐', name_en: 'R&B / Soul' },
  { aliases: ['soul'], code: '06.02', name_zh: '灵魂乐', name_en: 'Soul' },
  { aliases: ['contemporary r&b'], code: '06.03', name_zh: '当代 R&B', name_en: 'Contemporary R&B' },
  { aliases: ['pop soul'], code: '06.07', name_zh: '流行灵魂乐', name_en: 'Pop Soul' },
  { aliases: ['爵士', '爵士乐', 'jazz'], code: '07.01', name_zh: '爵士', name_en: 'Jazz' },
  { aliases: ['古典', 'classical'], code: '08.01', name_zh: '古典', name_en: 'Classical' },
  { aliases: ['器乐曲', 'instrumental'], code: '08.07', name_zh: '器乐独奏', name_en: 'Solo Instrumental' },
  { aliases: ['轻音乐', 'Easy Listening'], code: '09.01', name_zh: '轻音乐', name_en: 'Easy Listening' },
  { aliases: ['New Age', 'new age', '新世纪', '新世紀'], code: '09.02', name_zh: '新世纪', name_en: 'New Age' },
  { aliases: ['乡村', 'country'], code: '10.01', name_zh: '乡村', name_en: 'Country' },
  { aliases: ['世界音乐', 'Worldbeat', 'worldbeat', 'world music'], code: '11.02', name_zh: '世界音乐', name_en: 'World Music' },
  { aliases: ['中国古典音乐', '中国传统音乐', '中国弦乐', 'guqin', '古琴'], code: '11.03', name_zh: '中国传统', name_en: 'Chinese Traditional' },
  { aliases: ['中国风', '中國風', '国风', '國風', 'zhongguo feng'], code: '11.04', name_zh: '中国风', name_en: 'Chinese Style' },
  { aliases: ['民族乐', '民族音乐', '民族音樂'], code: '11.06', name_zh: '民族音乐', name_en: 'Ethnic Music' },
  { aliases: ['中国地方民歌', "shan'ge", '山歌'], code: '11.01', name_zh: '民歌', name_en: 'Folk Song' },
  { aliases: ['雷鬼', 'reggae'], code: '11.07', name_zh: '雷鬼', name_en: 'Reggae' },
  { aliases: ['enka'], code: '11.12', name_zh: '演歌', name_en: 'Enka' },
  { aliases: ['中国戏曲', '戏曲', '京剧', 'hd10: sheng', 'hd10: 生', 'hd20: dan', 'hd20: 旦', 'hd11: laosheng', 'hd11: 老生', 'hd21: qingyi', 'hd21: 青衣', 'hd30: jing', 'hd30: 净', 'hd12: xiaosheng', 'hd12: 小生', 'hd25: laodan', 'hd25: 老旦'], code: '11.13', name_zh: '中国戏曲', name_en: 'Chinese Opera' },
  { aliases: ['red song', '红歌', '紅歌'], code: '11.14', name_zh: '红歌', name_en: 'Red Song' },
  { aliases: ['基督教与福音', 'christian & gospel', 'gospel'], code: '11.15', name_zh: '基督教与福音', name_en: 'Christian and Gospel' },
  { aliases: ['soundtrack', '原声音乐', 'original soundtrack', 'ost', 'TV Soundtrack'], code: '12.01', name_zh: '原声', name_en: 'Soundtrack' },
  { aliases: ['vgm', 'video game music', 'video game', 'game music', '电子游戏', '电子游戏音乐'], code: '12.02', name_zh: '游戏音乐', name_en: 'Video Game Music' },
  { aliases: ['唱作', 'singer-songwriter', '唱作歌手', 'songwriter', 'シンガーソングライター', '싱어송라이터'], code: '90.01', name_zh: '唱作', name_en: 'Singer-Songwriter' },
  { aliases: ['儿童音乐', '儿童音樂', 'children', "children's music", 'チルドレン・ミュージック', 'キッズ／ファミリー', '어린이 음악', '어린이 및 청소년'], code: '90.02', name_zh: '儿歌', name_en: "Children's Music" },
  { aliases: ['独立音乐', '獨立音樂', 'indie music', '한국 인디'], code: '90.04', name_zh: '独立音乐', name_en: 'Indie' },
  { aliases: ['vocaloid', '虚拟歌姬', '虚拟歌手', '虚拟歌声'], code: '90.05', name_zh: '虚拟歌声/Vocaloid', name_en: 'Vocaloid / Virtual Vocal' },
]

const AUXILIARY_MAPPINGS = [
  { field: 'language_codes', code: '10', name_zh: '国语/普通话', name_en: 'Mandarin Chinese', aliases: ['mandarin', '国语', '國語', '普通话', '普通話', 'chinese', '中国音乐'] },
  { field: 'language_codes', code: '11', name_zh: '粤语', name_en: 'Cantonese', aliases: ['cantonese', '粤语', '粵語'] },
  { field: 'language_codes', code: '13', name_zh: '日语', name_en: 'Japanese', aliases: ['japanese', '日语', '日語'] },
  { field: 'language_codes', code: '14', name_zh: '韩语', name_en: 'Korean', aliases: ['korean', '韩语', '韓語'] },
  { field: 'language_codes', code: '15', name_zh: '英语', name_en: 'English', aliases: ['english', '英语', '英語'] },
  { field: 'region_code', code: '01', name_zh: '中国大陆', name_en: 'Mainland China', aliases: ['mainland china', 'beijing'] },
  { field: 'region_code', code: '02', name_zh: '中国香港', name_en: 'Hong Kong', aliases: ['hong kong', 'hong.kong', '香港'] },
  { field: 'region_code', code: '03', name_zh: '中国台湾', name_en: 'Taiwan', aliases: ['taiwan', 'taiwanese', '台湾', '臺灣'] },
  { field: 'gender_code', code: 'g', name_zh: '组合/乐队', name_en: 'Group / Band', aliases: ['乐队组合', '樂隊組合', '乐队', '樂隊', '组合', '組合', 'band', 'boy band', 'girl group', 'duo', 'group'] },
]

let ACTIVE_STYLE_MAPPINGS = []
let STYLE_BY_ALIAS = new Map()

function parseArgs(argv) {
  const options = {
    input: null,
    output: null,
    sample: null,
    qqRawMap: null,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--input') options.input = argv[++i]
    else if (arg === '--output') options.output = argv[++i]
    else if (arg === '--sample') options.sample = argv[++i]
    else if (arg === '--qq-raw-map') options.qqRawMap = argv[++i]
    else throw new Error(`Unknown argument: ${arg}`)
  }
  if (!options.input || !options.output) throw new Error('Usage: node scripts/tags/build-light-tags-from-evidence.mjs --input <evidence.jsonl> --output <light.json> [--sample <sample.json>] [--qq-raw-map <draft.json>]')
  return options
}

function absolute(file) {
  return path.isAbsolute(file) ? file : path.join(ROOT_DIR, file)
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

function styleMappingsFromTaxonomy(taxonomy) {
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

function activateStyleMappings(taxonomy) {
  const mappings = [...styleMappingsFromTaxonomy(taxonomy), ...SUPPLEMENTAL_STYLE_MAPPINGS]
  const byCode = new Map()
  for (const mapping of mappings) {
    if (!byCode.has(mapping.code)) byCode.set(mapping.code, { ...mapping, aliases: [] })
    const merged = byCode.get(mapping.code)
    merged.aliases = unique([...merged.aliases, ...(mapping.aliases || [])])
    merged.name_zh ||= mapping.name_zh
    merged.name_en ||= mapping.name_en
  }
  ACTIVE_STYLE_MAPPINGS = [...byCode.values()]
  STYLE_BY_ALIAS = new Map(ACTIVE_STYLE_MAPPINGS.flatMap((mapping) => (
    mapping.aliases.map((alias) => [normalizeAlias(alias), mapping])
  )))
}

function auxiliaryMatches(rawTag) {
  const tag = normalizeAlias(rawTag)
  return AUXILIARY_MAPPINGS.filter((mapping) => mapping.aliases.some((alias) => tag.includes(alias.toLowerCase())))
}

function isConvertedTerm(rawTag) {
  const tag = normalizeAlias(rawTag)
  return STYLE_BY_ALIAS.has(tag) || auxiliaryMatches(tag).length > 0
}

function allRawTags(row) {
  return unique((row.sources || []).flatMap((source) => source.raw_tags || []))
}

function defaultGenderCode(sample) {
  const typeBucket = sample?.qq_v8_context?.type_bucket
  if (typeBucket === 'man') return 'm'
  if (typeBucket === 'woman') return 'f'
  if (typeBucket === 'team') return 'g'
  return null
}

function defaultLanguageCodes(sample) {
  if (sample?.qq_v8_context?.region_bucket === 'cn') return ['10']
  if (sample?.qq_v8_context?.region_bucket === 'j') return ['13']
  if (sample?.qq_v8_context?.region_bucket === 'japan') return ['13']
  if (sample?.qq_v8_context?.region_bucket === 'k') return ['14']
  if (sample?.qq_v8_context?.region_bucket === 'korea') return ['14']
  return []
}

function defaultRegionCode(sample) {
  const regionBucket = sample?.qq_v8_context?.region_bucket
  if (regionBucket === 'cn') return null
  if (regionBucket === 'japan' || regionBucket === 'j') return '04'
  if (regionBucket === 'korea' || regionBucket === 'k') return '05'
  if (regionBucket === 'eu') return '06'
  return null
}

function qqRawStyleCodes(sample, qqRawMap, existingStyleCodes) {
  if (existingStyleCodes.size || !sample) return []
  return (sample.qq_v8_raw_tag_ids || []).map((id) => qqRawMap.get(String(id))).filter(Boolean)
}

function normalizeRow(row, sampleByArtistKey, qqRawMap) {
  const sample = sampleByArtistKey.get(row.artist_key)
  const styleCodes = new Set((row.normalized_candidates_preview || []).map((tag) => tag.style_code))
  const languageCodes = new Set([...(row.normalized_auxiliary_preview?.language_codes || []), ...defaultLanguageCodes(sample)])
  let genderCode = row.normalized_auxiliary_preview?.gender_code || defaultGenderCode(sample)
  let regionCode = row.normalized_auxiliary_preview?.region_code || defaultRegionCode(sample)
  const convertedTerms = new Set()

  for (const rawTag of allRawTags(row)) {
    const style = STYLE_BY_ALIAS.get(normalizeAlias(rawTag))
    if (style) {
      styleCodes.add(style.code)
      convertedTerms.add(rawTag)
    }
    for (const auxiliary of auxiliaryMatches(rawTag)) {
      convertedTerms.add(rawTag)
      if (auxiliary.field === 'gender_code' && !genderCode) genderCode = auxiliary.code
      else if (auxiliary.field === 'region_code' && !regionCode) regionCode = auxiliary.code
      else if (auxiliary.field === 'language_codes') languageCodes.add(auxiliary.code)
    }
  }
  for (const code of qqRawStyleCodes(sample, qqRawMap, styleCodes)) {
    styleCodes.add(code)
  }

  return {
    artist_key: row.artist_key,
    gender_code: genderCode || 'u',
    region_code: regionCode || '07',
    language_codes: [...languageCodes],
    style_codes: [...styleCodes],
    review_unmatched_raw_terms: unique((row.unmatched_raw_style_terms || []).filter((term) => !convertedTerms.has(term) && !isConvertedTerm(term))),
  }
}

function legendFromItems(items) {
  const styleCodes = new Set(items.flatMap((item) => item.style_codes))
  return {
    gender_codes: [
      { code: 'm', name_zh: '男', name_en: 'Male' },
      { code: 'f', name_zh: '女', name_en: 'Female' },
      { code: 'g', name_zh: '组合/乐队', name_en: 'Group / Band' },
      { code: 'u', name_zh: '未知', name_en: 'Unknown' },
    ],
    region_codes: [
      { code: '01', name_zh: '中国大陆', name_en: 'Mainland China' },
      { code: '02', name_zh: '中国香港', name_en: 'Hong Kong' },
      { code: '03', name_zh: '中国台湾', name_en: 'Taiwan' },
      { code: '04', name_zh: '日本', name_en: 'Japan' },
      { code: '05', name_zh: '韩国', name_en: 'South Korea' },
      { code: '06', name_zh: '欧美', name_en: 'Western' },
      { code: '07', name_zh: '其他/待确认', name_en: 'Other / Pending Review' },
    ],
    language_codes: [
      { code: '10', name_zh: '国语/普通话', name_en: 'Mandarin Chinese' },
      { code: '11', name_zh: '粤语', name_en: 'Cantonese' },
      { code: '12', name_zh: '闽南语', name_en: 'Southern Min' },
      { code: '13', name_zh: '日语', name_en: 'Japanese' },
      { code: '14', name_zh: '韩语', name_en: 'Korean' },
      { code: '15', name_zh: '英语', name_en: 'English' },
      { code: '19', name_zh: '待确认', name_en: 'Pending Review' },
    ],
    style_codes: ACTIVE_STYLE_MAPPINGS
      .filter((mapping) => styleCodes.has(mapping.code))
      .map((mapping) => ({ code: mapping.code, name_zh: mapping.name_zh, name_en: mapping.name_en })),
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const input = absolute(options.input)
  const output = absolute(options.output)
  const taxonomy = await readFile(TAXONOMY_FILE, 'utf8').then((text) => JSON.parse(text))
  activateStyleMappings(taxonomy)
  const sample = options.sample ? await readFile(absolute(options.sample), 'utf8').then((text) => JSON.parse(text)) : null
  const sampleByArtistKey = new Map((sample?.items || sample?.artists || []).map((item) => [item.artist_key, item]))
  const qqRawMapPayload = options.qqRawMap ? await readFile(absolute(options.qqRawMap), 'utf8').then((text) => JSON.parse(text)) : null
  const qqRawMap = new Map((qqRawMapPayload?.entries || [])
    .filter((entry) => entry.mapping_status === 'supported_draft' && entry.proposed_standard_tag?.standard_id)
    .map((entry) => [String(entry.raw_tag_id), entry.proposed_standard_tag.standard_id]))
  const rows = (await readFile(input, 'utf8')).trim().split('\n').filter(Boolean).map((line) => JSON.parse(line))
  const networkStyledKeys = new Set(rows.filter((row) => (row.normalized_candidates_preview || []).length).map((row) => row.artist_key))
  const items = rows.map((row) => normalizeRow(row, sampleByArtistKey, qqRawMap))
  const payload = {
    version: 2,
    status: 'nas_test_light_preview',
    generated_at: new Date().toISOString(),
    description: 'Compact light tag preview generated from network evidence. Names and source evidence are intentionally omitted.',
    source_file: path.relative(ROOT_DIR, input).replaceAll(path.sep, '/'),
    sample_file: sample ? path.relative(ROOT_DIR, absolute(options.sample)).replaceAll(path.sep, '/') : null,
    qq_raw_map_file: qqRawMapPayload ? path.relative(ROOT_DIR, absolute(options.qqRawMap)).replaceAll(path.sep, '/') : null,
    conversion_notes: [
      'Genre terms are converted to style_codes.',
      'Language, region, and group/band terms are converted to language_codes, region_code, and gender_code instead of being kept as unmatched style terms.',
      'When --sample is provided, QQ v8 type_bucket supplies default gender_code values: man=m, woman=f, team=g.',
      'When --qq-raw-map is provided, supported_draft QQ raw numeric tag mappings fill style_codes only for rows that still have no network-derived style.',
      'Era terms such as 1980s are not stored; phrases containing Hong Kong still set region_code=02.',
    ],
    code_legend: legendFromItems(items),
    stats: {
      item_count: items.length,
      rows_with_review_unmatched_terms: items.filter((item) => item.review_unmatched_raw_terms.length).length,
      rows_filled_by_supported_qq_raw_tags: items.filter((item) => !networkStyledKeys.has(item.artist_key) && item.style_codes.length).length,
    },
    items,
  }
  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, JSON.stringify(payload, null, 2) + '\n')
  console.log(`Wrote ${items.length} light rows to ${path.relative(ROOT_DIR, output)}`)
}

await main()
