# Artist Tag Package / 艺人标签包

This folder is designed to be a standalone lightweight repository for artist
tags.

这个目录可以作为一个独立的轻量仓库使用，主要保存艺人标签的正式成果，以及后续增量维护所需的最小脚本和字典。

It keeps:

- formal final tag tables
- the standard style taxonomy
- the minimum scripts needed to add new artists later

它保留的内容有：

- 正式标签结果表
- 标准风格字典
- 后续新增艺人时需要用到的最小脚本

It does not keep large source databases, monthly tables, or long-lived process
artifacts.

它不保留的内容有：

- 大体量平台源数据库
- 月更统计表
- 长期保存的过程产物

## Formal Tag Tables / 正式标签表

- `data/tags/cn-artist-light-tags.json`
- `data/tags/western-artist-light-tags.json`
- `data/tags/japan-artist-light-tags.json`
- `data/tags/korea-artist-light-tags.json`

Formal rows only store:

- `artist_key`
- `gender_code`
- `region_code`
- `language_codes`
- `style_codes`

正式表中的每一行只保留：

- `artist_key`
- `gender_code`
- `region_code`
- `language_codes`
- `style_codes`

Artist names, raw tags, URLs, and evidence text are not stored in the formal tag
tables.

正式标签表里不保存：

- 姓名
- 原始标签
- 来源链接
- 证据文本

## Dictionary / 风格字典

- `data/platform-source/qq/v8/dictionaries/standard-style-taxonomy.json`

Use this file to translate `style_codes`, for example `02.01` means Rock /
摇滚。

这个文件用来解释 `style_codes`。例如：`02.01` 表示“摇滚 / Rock”。

## Scripts / 脚本

- `scripts/tags/run-artist-tag-evidence-batch.mjs`
- `scripts/tags/build-light-tags-from-evidence.mjs`
- `scripts/tags/refresh-light-tags-from-preview.mjs`
- `scripts/tags/merge-new-light-tags.mjs`
- `scripts/tags/process-new-artists-queue.mjs`

## Local Work Area / 本地工作目录

- `work/`

Use `work/` for temporary evidence, preview files, summaries, and one-off
debug exports. This directory is ignored by git so the repo can stay compact.

这里用来存放临时过程文件，例如：

- evidence
- preview
- summary
- 临时调试导出

`work/` 默认不进入 git，这样仓库可以保持精简。

## Batch Queue / 批量新增入口

- `input/new-artists.queue.json`

You can put many new artists into this one file. A GitHub Action can read the
queue, fetch evidence, build preview tags, merge rows with usable
`style_codes`, and then update the formal tag tables automatically.

你可以把很多新艺人放进这个文件里，然后通过 GitHub Action 自动处理：

1. 按配置分组
2. 抓取证据
3. 生成 preview 标签
4. 把有可用 `style_codes` 的艺人合并进正式标签表
5. 上传过程文件为 workflow artifact

## Maintenance Guide / 维护说明

- `docs/maintenance-workflow.md`

This file explains the minimal update cycle for adding new artists without
keeping heavy old process files in the repo.

这份文档说明了后续如何以最精简的方式继续新增艺人，而不把大量历史过程文件放进仓库。

## GitHub Action

- `.github/workflows/artist-tags-queue.yml`

When `input/new-artists.queue.json` changes, the action can:

1. split artists by run config
2. fetch evidence
3. build preview light tags
4. merge usable rows into `data/tags/*.json`
5. upload temporary run files as workflow artifacts

So the repo keeps the final tables, while the heavy process output stays out of
git.

当 `input/new-artists.queue.json` 更新后，Action 可以自动执行整套流程。

这样做的好处是：

- 正式标签表自动更新回仓库
- 过程文件通过 artifact 保留
- 仓库本身仍然保持轻量

## Add Tags For New Artists / 如何新增艺人

### Manual Single Run / 手动单次处理

1. Prepare an input file using this template:

```text
input/new-artists.sample.json
```

准备输入文件：

```text
input/new-artists.sample.json
```

2. Fetch evidence:

```bash
node scripts/tags/run-artist-tag-evidence-batch.mjs \
  --input input/new-artists.sample.json \
  --output work/new-artists.evidence.jsonl \
  --summary work/new-artists.summary.json \
  --wiki-lang zh \
  --apple-country CN
```

Different region suggestions / 不同区域建议配置：

- Western / 欧美：`--wiki-lang en --apple-country US`
- Japan / 日本：`--wiki-lang ja --apple-country JP`
- Korea / 韩国：`--wiki-lang ko --apple-country KR`

3. Convert evidence to light tags:

```bash
node scripts/tags/build-light-tags-from-evidence.mjs \
  --input work/new-artists.evidence.jsonl \
  --sample input/new-artists.sample.json \
  --output work/new-artists.light-tags.preview.json
```

生成轻标签预览：

```bash
node scripts/tags/build-light-tags-from-evidence.mjs \
  --input work/new-artists.evidence.jsonl \
  --sample input/new-artists.sample.json \
  --output work/new-artists.light-tags.preview.json
```

4. Merge rows with non-empty `style_codes` into the formal tag tables:

```bash
node scripts/tags/merge-new-light-tags.mjs \
  --input work/new-artists.light-tags.preview.json
```

合并到正式标签表：

```bash
node scripts/tags/merge-new-light-tags.mjs \
  --input work/new-artists.light-tags.preview.json
```

Use `--dry-run` first if you only want to preview changes.

建议先加 `--dry-run` 预览结果。

### Batch Automation / 批量自动处理

Directly put new artists into / 直接把新艺人写进：

- `input/new-artists.queue.json`

Then push to GitHub and let the Action run / 然后 push 到 GitHub，让 Action 自动跑。

## Recommended Pattern / 建议的使用原则

- keep final tables in `data/tags/`
- keep temporary process output in `work/`
- only merge confirmed rows into the formal tables

- 正式成果只放在 `data/tags/`
- 临时过程文件只放在 `work/`
- 只把确认可用的标签写入正式表

## Query Flow / 查询方式

To check an artist tag:

1. Find the artist's `artist_key` from `../platform-source/data/name-source/artist-name-source.json` or another name index.
2. Search the four formal tag tables by `artist_key`.
3. Translate `style_codes` with `standard-style-taxonomy.json`.

如果要查询某个艺人的标签：

1. 先通过其他姓名索引找到 `artist_key`
2. 再在四张正式标签表中按 `artist_key` 查询
3. 用 `standard-style-taxonomy.json` 解释 `style_codes`

The formal tag tables are intentionally name-free, so name lookup should be
handled by a separate name index or platform source data.

因为正式标签表是去姓名化的，所以姓名检索建议放在独立的姓名索引或平台源表中完成。
