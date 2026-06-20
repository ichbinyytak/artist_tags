# Maintenance Workflow

This package keeps two things together:

- formal final tag tables
- the minimum scripts and reference files needed to add new artists later

It does **not** keep large evidence archives, monthly platform stats tables, or
full source databases.

## What To Keep In Git

Keep these files in the repo:

- `data/tags/*.json`
- `data/tags/README.md`
- `data/platform-source/qq/v8/dictionaries/standard-style-taxonomy.json`
- `input/new-artists.sample.json`
- `input/new-artists.queue.json`
- `scripts/tags/*.mjs`
- `README.md`
- `docs/maintenance-workflow.md`

## What To Keep Only Locally

Put temporary run files under `work/`:

- evidence jsonl
- run summaries
- preview light tag files
- one-off debug exports

`work/` is ignored by git on purpose.

## Minimal Update Cycle

When you need to add new artists:

1. Copy `input/new-artists.sample.json`
2. Fill in:
   - `artist_key`
   - `name`
   - `query_names`
   - platform ids if available
   - `qq_v8_context.region_bucket`
3. Fetch evidence into `work/`
4. Build preview light tags
5. Check preview rows that still have empty `style_codes`
6. Merge only confirmed rows into formal tag tables

If you prefer GitHub automation, you can instead:

1. put many artists into `input/new-artists.queue.json`
2. push that file
3. let GitHub Actions process the queue and update the formal tables

## Recommended Commands

Evidence:

```bash
npm run tags:evidence -- \
  --input input/new-artists.sample.json \
  --output work/new-artists.evidence.jsonl \
  --summary work/new-artists.summary.json \
  --wiki-lang zh \
  --apple-country CN
```

Preview:

```bash
npm run tags:build -- \
  --input work/new-artists.evidence.jsonl \
  --sample input/new-artists.sample.json \
  --output work/new-artists.light-tags.preview.json
```

Merge:

```bash
npm run tags:merge -- \
  --input work/new-artists.light-tags.preview.json \
  --dry-run
```

Then remove `--dry-run` after checking.

## GitHub Queue Automation

Queue input:

- `input/new-artists.queue.json`

Automation entry:

- `scripts/tags/process-new-artists-queue.mjs`

Workflow:

- `.github/workflows/artist-tags-queue.yml`

This flow is designed for lightweight long-term maintenance:

- final tables are committed back into git
- temporary evidence and previews are uploaded as workflow artifacts
- large backup/process files are not kept in the repo

## Region Defaults

- CN: `--wiki-lang zh --apple-country CN`
- Western: `--wiki-lang en --apple-country US`
- Japan: `--wiki-lang ja --apple-country JP`
- Korea: `--wiki-lang ko --apple-country KR`

## Practical Rule

This repo should stay lightweight:

- final result tables stay in git
- taxonomy and scripts stay in git
- temporary process output stays in `work/`

That gives you enough to upgrade and extend later without dragging old bulk
artifacts into the formal package.
