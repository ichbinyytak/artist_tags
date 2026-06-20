import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.dirname(path.dirname(SCRIPT_DIR))

function parseArgs(argv) {
  const options = {
    input: 'input/new-artists.queue.json',
    workDir: 'work/auto',
    merge: true,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--input') options.input = argv[++i]
    else if (arg === '--work-dir') options.workDir = argv[++i]
    else if (arg === '--no-merge') options.merge = false
    else throw new Error(`Unknown argument: ${arg}`)
  }

  return options
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

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'default'
}

function regionDefaultConfig(regionBucket) {
  if (regionBucket === 'cn') return { wiki_lang: 'zh', apple_country: 'CN' }
  if (regionBucket === 'eu' || regionBucket === 'western') return { wiki_lang: 'en', apple_country: 'US' }
  if (regionBucket === 'j' || regionBucket === 'japan') return { wiki_lang: 'ja', apple_country: 'JP' }
  if (regionBucket === 'k' || regionBucket === 'korea') return { wiki_lang: 'ko', apple_country: 'KR' }
  return { wiki_lang: 'zh', apple_country: 'CN' }
}

function configForItem(item) {
  const suggested = item.suggested_run_config || {}
  const fallback = regionDefaultConfig(item?.qq_v8_context?.region_bucket)
  return {
    wiki_lang: suggested.wiki_lang || fallback.wiki_lang,
    apple_country: suggested.apple_country || fallback.apple_country,
  }
}

function groupItems(items) {
  const groups = new Map()

  for (const item of items) {
    const config = configForItem(item)
    const key = `${config.wiki_lang}__${config.apple_country}`
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        config,
        items: [],
      })
    }
    groups.get(key).items.push(item)
  }

  return [...groups.values()]
}

function runNodeScript(scriptFile, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptFile, ...args], {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    })

    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${path.basename(scriptFile)} exited with code ${code}`))
    })
    child.on('error', reject)
  })
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const inputFile = absolute(options.input)
  const inputPayload = await readJson(inputFile)
  const items = inputPayload.items || inputPayload.artists || []

  if (!items.length) {
    console.log(JSON.stringify({
      ok: true,
      input_file: path.relative(ROOT_DIR, inputFile).replaceAll(path.sep, '/'),
      queue_count: 0,
      message: 'Queue file is empty. Nothing to process.',
    }, null, 2))
    return
  }

  const stamp = new Date().toISOString().replaceAll(':', '-')
  const runDir = absolute(path.join(options.workDir, stamp))
  await mkdir(runDir, { recursive: true })

  const groups = groupItems(items)
  const runSummary = {
    generated_at: new Date().toISOString(),
    input_file: path.relative(ROOT_DIR, inputFile).replaceAll(path.sep, '/'),
    queue_count: items.length,
    group_count: groups.length,
    groups: [],
    merge_enabled: options.merge,
  }

  for (const group of groups) {
    const groupSlug = slug(`${group.config.wiki_lang}-${group.config.apple_country}`)
    const sampleFile = path.join(runDir, `${groupSlug}.sample.json`)
    const evidenceFile = path.join(runDir, `${groupSlug}.evidence.jsonl`)
    const summaryFile = path.join(runDir, `${groupSlug}.summary.json`)
    const previewFile = path.join(runDir, `${groupSlug}.light-tags.preview.json`)

    await writeJson(sampleFile, {
      version: 1,
      description: `Grouped queue batch for ${group.config.wiki_lang}/${group.config.apple_country}`,
      items: group.items,
    })

    await runNodeScript(path.join(ROOT_DIR, 'scripts', 'tags', 'run-artist-tag-evidence-batch.mjs'), [
      '--input', sampleFile,
      '--output', evidenceFile,
      '--summary', summaryFile,
      '--wiki-lang', group.config.wiki_lang,
      '--apple-country', group.config.apple_country,
    ])

    await runNodeScript(path.join(ROOT_DIR, 'scripts', 'tags', 'build-light-tags-from-evidence.mjs'), [
      '--input', evidenceFile,
      '--sample', sampleFile,
      '--output', previewFile,
    ])

    if (options.merge) {
      await runNodeScript(path.join(ROOT_DIR, 'scripts', 'tags', 'merge-new-light-tags.mjs'), [
        '--input', previewFile,
      ])
    }

    runSummary.groups.push({
      key: group.key,
      wiki_lang: group.config.wiki_lang,
      apple_country: group.config.apple_country,
      item_count: group.items.length,
      sample_file: path.relative(ROOT_DIR, sampleFile).replaceAll(path.sep, '/'),
      evidence_file: path.relative(ROOT_DIR, evidenceFile).replaceAll(path.sep, '/'),
      summary_file: path.relative(ROOT_DIR, summaryFile).replaceAll(path.sep, '/'),
      preview_file: path.relative(ROOT_DIR, previewFile).replaceAll(path.sep, '/'),
    })
  }

  const runSummaryFile = path.join(runDir, 'run-summary.json')
  await writeJson(runSummaryFile, runSummary)

  console.log(JSON.stringify({
    ok: true,
    run_dir: path.relative(ROOT_DIR, runDir).replaceAll(path.sep, '/'),
    run_summary_file: path.relative(ROOT_DIR, runSummaryFile).replaceAll(path.sep, '/'),
    queue_count: items.length,
    group_count: groups.length,
    merge_enabled: options.merge,
  }, null, 2))
}

await main()
