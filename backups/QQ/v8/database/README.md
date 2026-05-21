# QQ v8 Generated Databases

记录时间：2026-05-21

这个目录保存从 QQ v8 老歌手列表入口生成的基础艺人库，以及可复现生成脚本。

## Current Databases

| file | source keys | count | status |
| --- | --- | ---: | --- |
| `qq-v8-cn-artist-basic.json` | `cn_man_all`, `cn_woman_all`, `cn_team_all` | 42769 | confirmed |
| `qq-v8-japan-artist-basic.json` | `j_man_all`, `j_woman_all`, `j_team_all` | 14986 | confirmed |
| `qq-v8-korea-artist-basic.json` | `k_man_all`, `k_woman_all`, `k_team_all` | 14837 | confirmed |
| `qq-v8-western-core-artist-basic.json` | `eu_man_all`, `eu_woman_all`, `eu_team_all` | 15670 | core |
| `qq-v8-western-extended-artist-basic.json` | `eu_man_all`, `eu_woman_all`, `eu_team_all` | 22991 | extended |

欧美/西方库采用双层策略：`core` 作为优先使用库，`extended` 作为补充库。原始全量库不进入正式数据库。

## Build Script

脚本：

```text
build-qq-v8-artist-basic.mjs
```

用法：

```bash
node backups/QQ/v8/database/build-qq-v8-artist-basic.mjs cn
node backups/QQ/v8/database/build-qq-v8-artist-basic.mjs japan
node backups/QQ/v8/database/build-qq-v8-artist-basic.mjs korea
node backups/QQ/v8/database/build-qq-v8-artist-basic.mjs all-confirmed
```

预留的欧美过滤版本：

```bash
node backups/QQ/v8/database/build-qq-v8-artist-basic.mjs western_core
node backups/QQ/v8/database/build-qq-v8-artist-basic.mjs western_extended
```

欧美规则：

- `western_core`: 保留 `Fother_name` 非空，或有中文名，或 `Fsinger_tag` 非空，或 `Fsort <= 30000`
- `western_extended`: 保留 `Fother_name` 非空，或有中文名，或 `Fsinger_tag` 非空，或 `Fsort <= 50000`

当前已生成 `western_core` 候选库：从欧美原始 `477608` 条中保留 `15670` 条，运行耗时约 `24.69s`。分桶保留量：
当前已生成两张欧美基础库，且输出结构与中日韩基础库一致：

- `eu_man_all`: `7585 / 404523`
- `eu_woman_all`: `3051 / 22562`
- `eu_team_all`: `5034 / 50523`

`western_extended` 分桶保留量：

- `eu_man_all`: `12066 / 404523`
- `eu_woman_all`: `4095 / 22562`
- `eu_team_all`: `6830 / 50523`

运行参数可用环境变量调整：

```bash
QQ_V8_CONCURRENCY=12 QQ_V8_BATCH_PAGES=120 node backups/QQ/v8/database/build-qq-v8-artist-basic.mjs cn
```

## Source Entry

```text
https://c.y.qq.com/v8/fcg-bin/v8.fcg
```

请求模板：

```text
https://c.y.qq.com/v8/fcg-bin/v8.fcg?channel=singer&page=list&key={KEY}&pagenum={PAGE}&pagesize=100&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq&needNewCode=0
```

推荐请求头：

```text
Referer: https://y.qq.com/n/ryqq_v2/singer_list
User-Agent: Mozilla/5.0
```

## Output Fields

每条艺人记录包含：

- `artist_id`: QQ 数字歌手 ID
- `artist_mid`: QQ 歌手 MID
- `name`: 主姓名
- `other_name`: v8 返回的别名/译名字段
- `aliases`: 从 `other_name` 和括号名拆出的别名
- `all_names`: 主名和别名合并去重
- `source_key`: 来源桶，例如 `cn_man_all`
- `region_bucket`: `cn`, `j`, `k`, `eu`
- `type_bucket`: `man`, `woman`, `team`
- `genre_bucket`: 当前主要是 `all`

## Notes

- 这些库只来自 v8 老列表入口，不包含粉丝数、歌曲数、专辑数。
- 粉丝数和歌曲/专辑统计需要后续从详情或关注数接口补。
- 目前五张基础库都使用统一基础结构，便于后续合并和比较。
- 欧美原始全量非常大且噪声高，应只保留规则，不直接作为正式数据库使用。
