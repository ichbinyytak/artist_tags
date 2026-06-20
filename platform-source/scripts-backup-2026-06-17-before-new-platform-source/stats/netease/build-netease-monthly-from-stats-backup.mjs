import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.dirname(path.dirname(SCRIPT_DIR))

function printUsage() {
  console.log([
    'Usage:',
    '  node scripts/netease/build-netease-monthly-from-stats-backup.mjs --input <stats-backup-json> --output <monthly-json> [options]',
    '',
    'Required:',
    '  --input         Netease artist stats backup json',
    '  --output        monthly output json',
    '',
    'Optional:',
    '  --description   custom description text',
    '',
    'Example:',
    '  node scripts/netease/build-netease-monthly-from-stats-backup.mjs \\',
    '    --input data/platform-source/netease/netease-artist-stats-backup.json \\',
    '    --output data/monthly/netease/netease-monthly.json',
  ].join('\n'))
}

function parseArgs(argv) {
  const options = {
    input: null,
    output: null,
    description: null,
    help: false,
  }

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
    if (arg === '--description') {
      options.description = argv[index + 1] || null
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

function toAbsolute(file) {
  if (!file) return null
  return path.isAbsolute(file) ? file : path.join(ROOT_DIR, file)
}

function toRelative(file) {
  return path.relative(ROOT_DIR, file).replaceAll(path.sep, '/')
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'))
}

async function saveJson(file, payload) {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(payload, null, 2) + '\n')
}

function readSourceArtists(payload) {
  return Array.isArray(payload) ? payload : payload?.artists || []
}

function asNumberOrNull(value) {
  return Number.isFinite(value) ? value : null
}

function sortMonthlyItems(items) {
  return [...items].sort((a, b) => {
    const aSong = a.song_count ?? -1
    const bSong = b.song_count ?? -1
    if (bSong !== aSong) return bSong - aSong

    const aAlbum = a.album_count ?? -1
    const bAlbum = b.album_count ?? -1
    if (bAlbum !== aAlbum) return bAlbum - aAlbum

    const aFan = a.fan_count ?? -1
    const bFan = b.fan_count ?? -1
    if (bFan !== aFan) return bFan - aFan

    return String(a.artist_key).localeCompare(String(b.artist_key))
  })
}

function buildMonthlyItem(sourceArtist, generatedAt) {
  const neteaseArtistId = String(sourceArtist.artist_id)

  return {
    artist_key: `wy:${neteaseArtistId}`,
    song_count: asNumberOrNull(sourceArtist.song_count),
    album_count: asNumberOrNull(sourceArtist.album_count),
    fan_count: asNumberOrNull(sourceArtist.fan_count),
    updated_at: generatedAt,
  }
}

function buildOutput({ generatedAt, description, inputFile, sourcePayload, items }) {
  const withSongCount = items.filter((item) => item.song_count !== null).length
  const withAlbumCount = items.filter((item) => item.album_count !== null).length
  const withFanCount = items.filter((item) => item.fan_count !== null).length

  return {
    generated_at: generatedAt,
    description,
    source_files: [toRelative(inputFile)],
    stats: {
      source_artist_count: items.length,
      items_with_song_count: withSongCount,
      items_with_album_count: withAlbumCount,
      items_with_fan_count: withFanCount,
      items_missing_song_count: items.length - withSongCount,
      items_missing_album_count: items.length - withAlbumCount,
      items_missing_fan_count: items.length - withFanCount,
      sorted_by: 'song_count_desc',
      source_snapshot_generated_at: sourcePayload?.generated_at ?? null,
      source_snapshot_artist_count: sourcePayload?.stats?.processed_count
        ?? sourcePayload?.stats?.artist_count
        ?? null,
      source_snapshot_error_count: sourcePayload?.stats?.error_count ?? null,
    },
    items: sortMonthlyItems(items),
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
  const generatedAt = new Date().toISOString()
  const description = options.description
    || `Netease monthly table transformed from ${toRelative(inputFile)}.`

  const items = sourceArtists.map((artist) => buildMonthlyItem(artist, generatedAt))
  const payload = buildOutput({
    generatedAt,
    description,
    inputFile,
    sourcePayload,
    items,
  })

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
