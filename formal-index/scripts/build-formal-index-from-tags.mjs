import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.dirname(path.dirname(SCRIPT_DIR))

const DEFAULT_TAG_FILES = [
  'tagging/data/tags/cn-artist-light-tags.json',
  'tagging/data/tags/western-artist-light-tags.json',
  'tagging/data/tags/japan-artist-light-tags.json',
  'tagging/data/tags/korea-artist-light-tags.json',
]

function parseArgs(argv) {
  const options = {
    tagFiles: DEFAULT_TAG_FILES,
    output: 'formal-index/data/formal-index-artist-keys.json',
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--output') options.output = argv[++i]
    else if (arg === '--tag-files') options.tagFiles = argv[++i].split(',').map((file) => file.trim()).filter(Boolean)
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return options
}

function absolute(file) {
  return path.isAbsolute(file) ? file : path.join(ROOT_DIR, file)
}

function relative(file) {
  return path.relative(ROOT_DIR, absolute(file)).replaceAll(path.sep, '/')
}

function idsFromArtistKey(artistKey) {
  return Object.fromEntries(String(artistKey || '').split('|').map((part) => part.split(':')).filter(([prefix, id]) => prefix && id))
}

async function readJson(file) {
  return JSON.parse(await readFile(absolute(file), 'utf8'))
}

async function writeJson(file, payload) {
  const target = absolute(file)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, JSON.stringify(payload, null, 2) + '\n')
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const byKey = new Map()
  const bucketCounts = {}

  for (const tagFile of options.tagFiles) {
    const payload = await readJson(tagFile)
    const bucket = path.basename(tagFile).replace('-artist-light-tags.json', '')
    bucketCounts[bucket] = 0
    for (const row of payload.items || []) {
      if (!row.artist_key) continue
      if (!byKey.has(row.artist_key)) {
        const ids = idsFromArtistKey(row.artist_key)
        byKey.set(row.artist_key, {
          artist_key: row.artist_key,
          qq_artist_id: ids.qq || null,
          netease_artist_id: ids.wy || null,
        })
      }
      bucketCounts[bucket] += 1
    }
  }

  const items = [...byKey.values()].sort((a, b) => a.artist_key.localeCompare(b.artist_key))
  const stats = {
    item_count: items.length,
    qq_id_count: items.filter((row) => row.qq_artist_id).length,
    netease_id_count: items.filter((row) => row.netease_artist_id).length,
    qq_netease_overlap_count: items.filter((row) => row.qq_artist_id && row.netease_artist_id).length,
    qq_only_count: items.filter((row) => row.qq_artist_id && !row.netease_artist_id).length,
    netease_only_count: items.filter((row) => !row.qq_artist_id && row.netease_artist_id).length,
    bucket_counts: bucketCounts,
  }

  await writeJson(options.output, {
    version: 1,
    generated_at: new Date().toISOString(),
    description: 'Formal artist index generated only from artists retained in formal tag tables. This is one unified index and is not split by platform.',
    source_tag_files: options.tagFiles.map(relative),
    stats,
    items,
  })
  console.log(JSON.stringify(stats, null, 2))
}

await main()
