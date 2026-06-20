# Database Structure Overview

记录时间：2026-05-21

这份表格用于快速看清当前数据库、规划中的数据库、它们之间的关系，以及各自包含的主要字段。

配套规则文件见：[database-build-rules.md](/home/yytak/Documents/artist-database/backups/database-build-rules.md)

## 一览图

```text
QQ v8 各区基础 ID 库 ─┐
QQ 旧基础库/详情备份 ─┼─> 标签 ID 索引表 ─┬─> 标签表
网易基础库 ──────────┘                   ├─> QQ 月更表
重叠表 overlap ──────────────────────────┤
                                         ├─> 网易月更表
QQ/网易/网页低频静态信息 ────────────────┤
                                         └─> 冷数据表

QQ / 网易 / 其他来源姓名集合 ───────────> 姓名搜索索引表 ──> artist_key
```

## 当前已有数据库

| 名称 | 文件 | 当前作用 | 记录数 | 主要字段 | 备注 |
| --- | --- | --- | ---: | --- | --- |
| 重叠表 | `database/overlap-artist-base.json` | 当前跨平台重叠事实库 | 23237 | `identity`, `genres`, `tags`, `platforms`, `match` | 信息最全，但偏重，适合做来源库，不适合直接做轻量主库 |
| 网易基础库 | `database/netease-artist-base.json` | 网易原始艺人基础数据 | 39299 | `name`, `aliases`, `name_keys`, `platform_ids`, `user_id`, `regions`, `languages`, `artist_type` | `user_id` 用于后续粉丝数抓取；没有时也保留为 `null` |
| QQ 旧基础库 | `database/qq-artist-base.json` | 旧版 QQ 原始艺人基础数据 | 48697 | `name`, `aliases`, `name_keys`, `platform_ids`, `tags`, `tag_ids_unmapped`, `regions`, `languages`, `artist_type` | 目前不再作为主来源，但仍可参考 |
| QQ v8 中文基础库 | `backups/QQ/v8/database/qq-v8-cn-artist-basic.json` | QQ v8 中文区基础 ID 库 | 42769 | `artist_id`, `artist_mid`, `name`, `other_name`, `aliases`, `all_names`, `source_key`, `region_bucket`, `type_bucket`, `genre_bucket` | 当前 QQ 新主来源之一 |
| QQ v8 日本基础库 | `backups/QQ/v8/database/qq-v8-japan-artist-basic.json` | QQ v8 日本区基础 ID 库 | 14986 | 同上 | 当前 QQ 新主来源之一 |
| QQ v8 韩国基础库 | `backups/QQ/v8/database/qq-v8-korea-artist-basic.json` | QQ v8 韩国区基础 ID 库 | 14837 | 同上 | 当前 QQ 新主来源之一 |
| QQ v8 欧美核心库 | `backups/QQ/v8/database/qq-v8-western-core-artist-basic.json` | QQ v8 欧美核心基础 ID 库 | 15670 | 同上 | 欧美主用库 |
| QQ v8 欧美扩展库 | `backups/QQ/v8/database/qq-v8-western-extended-artist-basic.json` | QQ v8 欧美扩展基础 ID 库 | 22991 | 同上 | 欧美补充库 |
| QQ 详情统计备份 | `temp4/qq-artist-stats-backup.json` | QQ 详情抓取样本库 | 6803 | `artist_id`, `artist_mid`, `name`, `aliases`, `name_keys`, `tags`, `song_count`, `album_count`, `fan_count` | 可作为月更和标签抓取样本参考 |

## 规划中的数据库

| 名称 | 规划定位 | 主要来源 | 主键/关联键 | 建议字段 | 更新频率 |
| --- | --- | --- | --- | --- | --- |
| 标签 ID 索引表 | 全库最轻量主索引 | `overlap` + QQ v8 五库 + 网易基础库 | `artist_key` | `artist_key`, `name` | 按需更新 |
| 标签表 | 静态标签主表 | 两平台 ID 表 + 后续标签抓取结果 | `artist_key` | `artist_key`, `gender_code`, `region_code`, `language_codes`, `style_codes` | 低频，一年一次左右 |
| QQ 月更表 | QQ 高频变化数据表 | QQ 详情页/统计抓取 | `artist_key` | `artist_key`, `album_count`, `song_count`, `fan_count`, `updated_at` | 月更；依赖 QQ ID 表中的 `artist_mid` |
| 网易月更表 | 网易高频变化数据表 | `data/platform-source/netease/netease-artist-stats-backup.json` | `wy:{id}` | `artist_key`, `album_count`, `song_count`, `fan_count`, `updated_at` | 月更；只覆盖网易 stats backup 范围 |
| 网易剩余库 | 网易单平台剩余保留库 | 网易未匹配剩余艺人及其辅助统计 | `wy:{id}` | `artist_key`, `netease_artist_id`, `name`, `album_count`, `song_count`, `fan_count` | 非正式月更主线，按需更新 |
| 冷数据表 | 低频静态详情表 | QQ 标签首次抓取 + 网易/网页低频补充 | `artist_key` | `artist_key`, `qq_raw_tags`, `netease_raw_tags`, `detail_snapshot`, `updated_at` | 很低频 |
| 姓名搜索索引表 | 搜索专用映射表 | QQ/网易各 ID 表姓名集合 | `name_key` -> `artist_key` | `name_key`, `artist_key`, `name`, `source` | 按需更新 |

## 各数据库之间的关系

| 上游表 | 下游表 | 关系 | 用途 |
| --- | --- | --- | --- |
| `overlap-artist-base.json` | 标签 ID 索引表 | 提供已重叠艺人的 QQ/网易对应关系 | 形成统一 `artist_key` 的核心依据 |
| QQ v8 五库 | 标签 ID 索引表 | 提供 QQ 侧全量基础 ID、`artist_mid` 和姓名 | 补齐 QQ-only 艺人，并为后续 QQ 抓取提供稳定入口 |
| 网易基础库 | 标签 ID 索引表 | 提供网易侧基础 ID、`user_id` 和姓名 | 补齐 网易-only 艺人，并为后续网易粉丝数抓取提供入口 |
| 标签 ID 索引表 | 标签表 | 1 对 1 | 让标签表只围绕 `artist_key` 组织 |
| 标签 ID 索引表 | QQ 月更表 | 1 对 1 | 让月更表不必重复存平台 ID |
| 网易 stats backup | 网易月更表 | 1 对 1 | 网易正式月更只从 `netease-artist-stats-backup.json` 转换生成 |
| 网易基础库 / 剩余未匹配集合 | 网易剩余库 | 1 对 1 | 保留未进入正式索引体系的网易单平台艺人 |
| 标签 ID 索引表 | 冷数据表 | 1 对 1 或 1 对多 | 保存低频静态补充信息 |
| QQ/网易姓名集合 | 姓名搜索索引表 | 多对多映射到 `artist_key` | 负责别名/异名搜索 |

## 字段层级建议

| 层级 | 应该放什么 | 不应该放什么 |
| --- | --- | --- |
| 标签 ID 索引表 | `artist_key`, 单一主姓名 | 别名集合、静态标签、月更统计 |
| 标签表 | `artist_key`、性别、地区、语言、风格代码 | 姓名、别名、平台 ID、月更统计、复杂来源说明 |
| QQ 月更表 | 专辑数、歌曲数、粉丝数、更新时间 | 姓名、标签、平台 ID |
| 网易月更表 | 专辑数、歌曲数、粉丝数、更新时间 | 姓名、标签、平台 ID |
| 网易剩余库 | 网易单平台姓名、基础统计 | 正式合并关系、正式月更定位 |
| 冷数据表 | 原始标签、静态详情快照 | 高频月更字段 |
| 姓名搜索索引表 | 归一化姓名键、原始姓名、`artist_key` | 月更统计、复杂标签 |

## 源表必备字段

| 源表 | 必须保留字段 | 原因 |
| --- | --- | --- |
| QQ ID 表 | `artist_id`, `artist_mid`, `name` | `artist_mid` 是 QQ 详情页和接口抓取的稳定入口 |
| 网易 ID 表 | `platform_ids.netease`, `user_id`, `name` | `user_id` 是网易粉丝数抓取的必要前置字段；没有也必须写成 `null` |

## 当前推荐的主路径

| 需求 | 优先查哪张表 | 说明 |
| --- | --- | --- |
| 找到某个歌手是谁 | 姓名搜索索引表 | 先通过名字找到 `artist_key` |
| 看歌手主身份 | 标签 ID 索引表 | 只看最精简主信息 |
| 看歌手静态分类 | 标签表 | 性别、地区、语言、风格都在这里 |
| 看歌手最新热度和规模 | QQ 月更表 / 网易月更表 | 高频动态数据单独查询 |
| 看未合并网易剩余艺人 | 网易剩余库 | 只作保留和参考，不进入正式月更主线 |
| 看原始标签或低频详情 | 冷数据表 | 只在需要时才查 |

## 当前结论

- 当前最适合作为 QQ 新主来源的是 QQ v8 五库。
- 当前最适合作为跨平台事实来源的是 `overlap-artist-base.json`。
- 未来正式数据库不建议直接沿用现有重叠表结构，而应拆成更轻的索引层、标签层、月更层和搜索层。
- `artist_key` 是未来所有正式表之间的统一连接键。
- 网易剩余未匹配艺人应作为单平台剩余库保留，不纳入正式月更主线。
