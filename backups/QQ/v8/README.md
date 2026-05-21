# QQ v8 Singer List Entry

记录时间：2026-05-21

这个目录集中保存 QQ 音乐 v8 老歌手列表入口的说明、字典和调查记录。以后只看这里，就能找到老入口的请求方式、参数、字段和目前已确认的判断。

## Endpoint

```text
https://c.y.qq.com/v8/fcg-bin/v8.fcg
```

典型请求：

```text
https://c.y.qq.com/v8/fcg-bin/v8.fcg?channel=singer&page=list&key={KEY}&pagenum={PAGE}&pagesize=100&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq&needNewCode=0
```

建议请求头：

```text
Referer: https://y.qq.com/n/ryqq_v2/singer_list
User-Agent: Mozilla/5.0
```

## Query Parameters

- `channel=singer`
- `page=list`
- `key={KEY}`
- `pagenum={PAGE}`: 1-based page number
- `pagesize=100`: 当前实测每页最多 100 条
- `format=json`
- `inCharset=utf8`
- `outCharset=utf-8`
- `notice=0`
- `platform=yqq`
- `needNewCode=0`

无效 `key` 的表现：

- HTTP 状态仍可能是 `200`
- 响应体可能只有空白，不能当成 JSON 解析

## Stable Keys

当前确认稳定有效的大桶：

```text
all_all_all

cn_man_all
cn_woman_all
cn_team_all

j_man_all
j_woman_all
j_team_all

k_man_all
k_woman_all
k_team_all

eu_man_all
eu_woman_all
eu_team_all
```

`key` 大致结构：

```text
{region}_{type}_{bucket}
```

已知 region：

- `all`: 全部
- `cn`: 中文区
- `j`: 日本
- `k`: 韩国
- `eu`: 欧美/西方

已知 type：

- `man`: 男歌手
- `woman`: 女歌手
- `team`: 组合/乐队

已知 bucket：

- `all`: 当前最稳定的大桶
- `9`: 已实测 `cn_man_9` 有效，但还未完成系统枚举和语义确认

## Current Totals

当前实测数量：

```text
all_all_all   552503

cn_man_all     23882
cn_woman_all   13989
cn_team_all     4898

j_man_all       5485
j_woman_all     4815
j_team_all      4686

k_man_all       7190
k_woman_all     3493
k_team_all      4154

eu_man_all    404523
eu_woman_all   22562
eu_team_all    50523
```

中文三桶合计：

```text
42769
```

## Response Fields

单条歌手记录稳定字段：

- `Fsinger_id`: QQ 数字歌手 ID
- `Fsinger_mid`: QQ 歌手 MID
- `Fsinger_name`: 主姓名
- `Fother_name`: 别名、外文名或中文译名
- `Fsinger_tag`: 标签 ID 串，例如 `541,555`
- `Farea`: 地区大类编码
- `Ftype`: 类型编码
- `Fgenre`: 基础风格码
- `Findex`: 首字母/索引字符
- `Fsort`: 桶内排序位次
- `Ftrend`: 趋势，常见值 `-1`, `0`, `1`
- `Fattribute_3`: 内部细分类码，当前看起来很像更细地区/市场码
- `Fattribute_4`: 内部二值属性，常见值 `0`, `1`
- `voc`: 稳定存在，语义未确认

## Confirmed Field Meaning

`Ftype` 已基本确认：

- `0`: 男歌手
- `1`: 女歌手
- `2`: 组合/乐队

`Ftrend` 当前可先按趋势信号保存：

- `-1`: 下降
- `0`: 持平
- `1`: 上升

`Farea` 当前可先按大区保存：

- 中文桶会出现 `0`, `1`
- 日本、韩国桶当前出现 `2`
- 欧美桶当前出现 `3`

`Fattribute_3` 当前规律：

- 日本桶固定常见 `4`
- 韩国桶固定常见 `5`
- 中文桶常见 `0`, `1`, `2`, `3`, `24`, `44`, `82`
- 欧美桶取值更散，例如 `6`, `7`, `8`, `9`, `10`, `13`, `15`, `26`, `30`, `52` 等

## Fast Table Shape

老入口最适合快速生成 QQ 艺人基础索引表。推荐字段：

```json
{
  "artist_id": 4558,
  "artist_mid": "0025NhlN2yWrP4",
  "name": "周杰伦",
  "aliases": ["Jay Chou"],
  "source_key": "cn_man_all",
  "region_bucket": "cn",
  "type_bucket": "man",
  "genre_bucket": "all",
  "area_code": "0",
  "type_code": "0",
  "index": "Z",
  "tag_ids": ["541", "555"],
  "sort_rank": 2,
  "trend": 0,
  "attribute_3": "2",
  "attribute_4": "0",
  "genre_code": "0",
  "voc": "0"
}
```

## What This Entry Gives Quickly

老入口可以快速、稳定得到：

- QQ 数字 ID
- QQ MID
- 主姓名
- 别名/译名
- 地区桶
- 男/女/组合桶
- 首字母索引
- 标签 ID
- 桶内排序
- 趋势信号
- 内部分类码

## What This Entry Does Not Give

只靠老入口拿不到：

- 粉丝数
- 歌曲数
- 专辑数
- MV 数
- 简介
- 结构化语言
- 结构化国家名
- 高清头像
- 相似歌手

这些需要后续用详情接口或关注数接口补，不属于 v8 老列表入口本身。

## Files In This Directory

- [qq-v8-singer-list-investigation.md](./qq-v8-singer-list-investigation.md): 早期调查记录和旧库对照
- [qq-v8-bucket-counts.md](./qq-v8-bucket-counts.md): 老入口各大分类桶数量
- [qq-tag-id-dictionary.md](./qq-tag-id-dictionary.md): QQ 标签 ID 说明
- [qq-tag-id-dictionary.json](./qq-tag-id-dictionary.json): QQ 标签 ID 字典数据
- [qq-genre-category-dictionary.json](./qq-genre-category-dictionary.json): QQ 风格分类字典

## Generated Databases

当前已确认可用的 v8 基础库放在 [database/](./database/)：

- [database/qq-v8-cn-artist-basic.json](./database/qq-v8-cn-artist-basic.json): 中文区艺人基础库，42769 条
- [database/qq-v8-japan-artist-basic.json](./database/qq-v8-japan-artist-basic.json): 日本艺人基础库，14986 条
- [database/qq-v8-korea-artist-basic.json](./database/qq-v8-korea-artist-basic.json): 韩国艺人基础库，14837 条

欧美/西方库仍在研究过滤规则，暂不放入正式 `database/` 目录。

## Next Investigation Targets

- 系统枚举第三段 bucket，确认除了 `all` 和 `9` 以外还有哪些可用值
- 继续解码 `Fattribute_3`, `Fattribute_4`, `voc`
- 扩展 `Fsinger_tag` 到可读标签的映射覆盖
- 用老入口生成新的 QQ 基础索引表，再决定是否用详情接口补统计字段
