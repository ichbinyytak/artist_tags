# QQ v8 Bucket Counts

记录时间：2026-05-21

这份文件只记录 QQ v8 老歌手列表入口各大分类桶的当前数量，方便后续快速查规模。

## Entry

```text
https://c.y.qq.com/v8/fcg-bin/v8.fcg?channel=singer&page=list&key={KEY}&pagenum=1&pagesize=100&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq&needNewCode=0
```

## Total

| key | description | total |
| --- | --- | ---: |
| `all_all_all` | 全部歌手 | 552503 |

## Region Summary

| region | included keys | total |
| --- | --- | ---: |
| 中文区 | `cn_man_all` + `cn_woman_all` + `cn_team_all` | 42769 |
| 日本 | `j_man_all` + `j_woman_all` + `j_team_all` | 14986 |
| 韩国 | `k_man_all` + `k_woman_all` + `k_team_all` | 14837 |
| 欧美/西方 | `eu_man_all` + `eu_woman_all` + `eu_team_all` | 477608 |

## Chinese

| key | category | total |
| --- | --- | ---: |
| `cn_man_all` | 中文区男歌手 | 23882 |
| `cn_woman_all` | 中文区女歌手 | 13989 |
| `cn_team_all` | 中文区组合/乐队 | 4898 |
| `cn_*_all` | 中文区合计 | 42769 |

## Japan

| key | category | total |
| --- | --- | ---: |
| `j_man_all` | 日本男歌手 | 5485 |
| `j_woman_all` | 日本女歌手 | 4815 |
| `j_team_all` | 日本组合/乐队 | 4686 |
| `j_*_all` | 日本合计 | 14986 |

## Korea

| key | category | total |
| --- | --- | ---: |
| `k_man_all` | 韩国男歌手 | 7190 |
| `k_woman_all` | 韩国女歌手 | 3493 |
| `k_team_all` | 韩国组合/乐队 | 4154 |
| `k_*_all` | 韩国合计 | 14837 |

## Europe And America

| key | category | total |
| --- | --- | ---: |
| `eu_man_all` | 欧美/西方男歌手 | 404523 |
| `eu_woman_all` | 欧美/西方女歌手 | 22562 |
| `eu_team_all` | 欧美/西方组合/乐队 | 50523 |
| `eu_*_all` | 欧美/西方合计 | 477608 |

## Notes

- 当前 `all_all_all` 总数是 `552503`。
- 四个地区大桶相加也是 `552503`，说明这套大桶当前能完整覆盖 `all_all_all`。
- 中文区合计 `42769`，这是后续重建 QQ 中文艺人基础表时最稳定的起点。
- 欧美/西方男歌手桶特别大，当前是 `404523`，后续如果做全量表要格外注意质量筛选。

