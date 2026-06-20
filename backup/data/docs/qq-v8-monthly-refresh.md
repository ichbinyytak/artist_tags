# QQ v8 Monthly Refresh

正式全量月更脚本：

- `scripts/qq/build-qq-v8-monthly-full.mjs`

这个脚本适用于 QQ v8 基础库，只要源文件结构是：

- `generated_at`
- `source`
- `artists`
- `stats`

并且 `artists` 里有：

- `artist_id`
- `artist_mid`
- `name`

就可以直接复用。

## 常用命令

欧美 core：

```bash
node scripts/qq/build-qq-v8-monthly-full.mjs \
  --input data/platform-source/qq/v8/database/qq-v8-western-core-artist-basic.json \
  --output data/monthly/qq/qq-v8-western-core-monthly.json \
  --force-refetch
```

韩国：

```bash
node scripts/qq/build-qq-v8-monthly-full.mjs \
  --input data/platform-source/qq/v8/database/qq-v8-korea-artist-basic.json \
  --output data/monthly/qq/qq-v8-korea-monthly.json \
  --force-refetch
```

日本：

```bash
node scripts/qq/build-qq-v8-monthly-full.mjs \
  --input data/platform-source/qq/v8/database/qq-v8-japan-artist-basic.json \
  --output data/monthly/qq/qq-v8-japan-monthly.json \
  --force-refetch
```

中国：

```bash
node scripts/qq/build-qq-v8-monthly-full.mjs \
  --input data/platform-source/qq/v8/database/qq-v8-cn-artist-basic.json \
  --output data/monthly/qq/qq-v8-cn-monthly.json \
  --force-refetch
```

## 说明

- 默认会输出同名断点文件：`<output>.progress.json`
- 默认按 `song_count` 从多到少排序
- 默认会补齐：
  - `song_count`
  - `album_count`
  - `fan_count`
- 如果不加 `--force-refetch`，会优先复用已有 progress 里的已完成数据
