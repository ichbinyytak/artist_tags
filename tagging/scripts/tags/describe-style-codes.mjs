import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.dirname(path.dirname(SCRIPT_DIR))
const TAXONOMY_FILE = path.join(ROOT_DIR, 'data/platform-source/qq/v8/dictionaries/standard-style-taxonomy.json')

const codes = process.argv.slice(2)
if (!codes.length) {
  console.error('Usage: node scripts/tags/describe-style-codes.mjs <style_code...>')
  process.exit(1)
}

const taxonomy = JSON.parse(await readFile(TAXONOMY_FILE, 'utf8'))
const byCode = new Map((taxonomy.styles || []).map((style) => [style.standard_style_id, style]))

for (const code of codes) {
  const style = byCode.get(code)
  if (!style) {
    console.log(`${code}\tUNKNOWN`)
  } else {
    console.log(`${code}\t${style.name_zh}\t${style.name_en}`)
  }
}
