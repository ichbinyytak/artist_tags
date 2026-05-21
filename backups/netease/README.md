# Netease Backup Rules

这个目录保存网易艺人月更/备份相关产物和规则。

## 当前文件

- `netease-artist-stats-backup.json`
  - 网易艺人轻量统计备份正式文件
- `netease-artist-stats-backup.progress.json`
  - 运行中断点续跑和进度文件

## 当前备份结构

每条艺人记录保留：

- `artist_id`
- `name`
- `aliases`
- `name_keys`
- `song_count`
- `album_count`
- `fan_count`

说明：

- `song_count` 对应网易 `musicSize`
- `album_count` 对应网易 `albumSize`
- `fan_count` 只有当艺人存在可用 `userId` 时才能抓到，否则为 `null`

## 抓取规则

1. 所有艺人每次都先请求 `head` 接口。
2. `head` 接口是主数据来源，用来拿：
   - `artist_id`
   - `name`
   - `song_count`
   - `album_count`
   - `userId`
3. 只有当 `head` 返回 `userId` 时，才继续请求用户详情接口抓 `fan_count`。
4. 如果 `head` 没有 `userId`：
   - 直接记 `fan_count = null`
   - 不额外请求粉丝接口
5. 不永久跳过任何艺人。
6. 即使某艺人上个月没有 `userId`，下个月仍然查一次 `head`。
   - 如果以后某个月出现了新的 `userId`
   - 就自动开始抓粉丝数

## 速度优化规则

- 优先走 `head` 接口，不抓网页 HTML。
- 不用网页地址直接解析字段，因为网页返回体更大，速度不如接口。
- 不主动请求 `/api/v1/artist/:id`，因为当前口径下 `head` 已足够提供歌曲数和专辑数。
- 只有 `head` 里存在 `userId` 时才请求用户详情接口。
- 使用断点续跑，已完成艺人直接复用，不重复抓取。

## 断点续跑

- `netease-artist-stats-backup.progress.json` 是断点文件。
- 脚本再次运行时会优先读取它，跳过已抓取艺人。
- 正式完成后，`json` 和 `progress.json` 内容应基本一致。

## 当前结果口径

- 网易骨架表总行数曾为 `39299`
- 其中存在 `23` 个重复 `artist_id`
- 当前唯一艺人 ID 数为 `39276`
- 备份结果按 `artist_id` 去重保存

## 运行方式

在仓库目录运行：

```bash
node scripts/build-netease-artist-stats-backup.mjs
```

可用环境变量：

```bash
NETEASE_ARTIST_STATS_CONCURRENCY=8
NETEASE_ARTIST_STATS_DELAY_MS=25
NETEASE_ARTIST_STATS_START_INDEX=0
NETEASE_ARTIST_STATS_LIMIT=0
NETEASE_ARTIST_STATS_SAVE_EVERY=100
NETEASE_ARTIST_STATS_FETCH_FANS=1
```

说明：

- `FETCH_FANS=1` 表示抓粉丝数
- 如果以后只想极速重刷歌曲数/专辑数，可临时设为 `0`
- 但正式月更建议保持 `1`
