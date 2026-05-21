# QQ v8 Singer List Investigation

记录时间：2026-05-21

这份笔记记录 QQ 音乐歌手列表旧接口和当前 `database/qq-artist-base.json` 只包含 4 万多歌手的线索。后续继续追查时，优先从这里接着看。

## 关键结论

- `https://y.qq.com/n/ryqq_v2/singer_list` 新版页面现在主要调用 `musicu.fcg`：
  - module: `music.musichallSinger.SingerList`
  - method: `GetSingerListIndex`
- 这个新版接口的默认“全部歌手”口径当前只返回约 `6803` 条，不是旧库 4 万多的来源。
- 旧库更像来自 QQ 老接口：

```text
https://c.y.qq.com/v8/fcg-bin/v8.fcg
```

示例请求：

```text
https://c.y.qq.com/v8/fcg-bin/v8.fcg?channel=singer&page=list&key=all_all_all&pagenum=1&pagesize=100&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq&needNewCode=0
```

返回字段与旧库字段高度对应：

- `Fsinger_id` -> `platform_ids.qq`
- `Fsinger_mid` -> `platform_ids.qq_mid`
- `Fsinger_name` -> `name`
- `Fother_name` -> `aliases`
- `Fsinger_tag` -> `tags` / `tag_ids_unmapped`
- `Farea` -> `regions`
- `Ftype` -> `artist_type`
- `Fsort` -> 当前老接口内部排序

## 当前旧接口实测

`all_all_all` 当前返回：

- `total = 552503`
- `total_page = 5526`
- 每页实际 `100` 条

样例首条：

```json
{
  "Farea": "1",
  "Fattribute_3": "3",
  "Fattribute_4": "0",
  "Fgenre": "0",
  "Findex": "X",
  "Fother_name": "Joker",
  "Fsinger_id": "5062",
  "Fsinger_mid": "002J4UUk29y8BY",
  "Fsinger_name": "薛之谦",
  "Fsinger_tag": "541,555",
  "Fsort": "1",
  "Ftype": "0"
}
```

所以问题不是老接口不可用，也不是接口收窄，而是当前老接口口径已经非常大，远大于旧库的 `48697`。

## 旧库现状

文件：

```text
database/qq-artist-base.json
```

统计：

- `artist_count = 48697`
- `tagged_artist_count = 18135`
- `region_artist_count = 48692`
- `artist_type_count = 48624`

地区分布的关键发现：

- 旧库里包含 `chinese` 的歌手数是 `42769`
- 当前老接口这三个中文桶相加也正好是 `42769`：
  - `cn_man_all = 23882`
  - `cn_woman_all = 13989`
  - `cn_team_all = 4898`

这几乎可以确认：旧库完整收录了中文区三个人群桶。

## 分桶覆盖率线索

当前老接口分桶与旧库覆盖率对照：

```text
cn_man_all    total 23882  in old base 23882
cn_woman_all  total 13989  in old base 13989
cn_team_all   total  4898  in old base  4898

j_man_all     total  5485  in old base   242
j_woman_all   total  4815  in old base   275
j_team_all    total  4686  in old base   271

k_man_all     total  7190  in old base   388
k_woman_all   total  3493  in old base   235
k_team_all    total  4154  in old base   237

eu_woman_all  total 22562  in old base   300
eu_team_all   total 50523  in old base   498
eu_man_all    total 404523 sampled first 3000, in old base 487
```

解释：

- 中文桶是全量收录。
- 日韩/欧美不是全量收录，只保留了一小部分。
- 非中文部分更像是热门、已有标签、或某种质量规则筛出来的骨架。

## 已排除的猜想

### 不是简单抓了 `all_all_all` 前 487 页

因为旧库数量 `48697` 很像 `487 * 100`，曾经怀疑是抓到第 487 页停止。

实测当前 `all_all_all` 前 487 页：

- 行数：`48700`
- 去重后：`48700`
- 与旧库交集：`24140`
- 旧库不在这 487 页内：`24557`

所以旧库不是简单的 `all_all_all` 前 487 页快照。

## 待继续验证

明天可以继续验证这些方向：

1. 旧库是否等于：
   - 中文三桶全量
   - 再加 `all_all_all` 热门排序中的部分非中文歌手
2. 非中文歌手进入旧库的规则是否与这些字段相关：
   - `Fsinger_tag` 非空
   - `Fsort` 排名靠前
   - 有中文别名或括号中文名
   - 有歌曲、专辑、粉丝数
3. 当前老接口的 `all_all_all` 膨胀到 `552503` 后，是否混入了大量低质量、无作品、系统歌手、合集歌手或版权占位歌手。
4. 如果要重建旧库，应优先复刻“中文全量 + 非中文精选”的口径，而不是直接把 55 万全灌入主库。

## 可复用请求模板

中文三桶：

```text
cn_man_all
cn_woman_all
cn_team_all
```

日韩欧美桶：

```text
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

请求格式：

```text
https://c.y.qq.com/v8/fcg-bin/v8.fcg?channel=singer&page=list&key={KEY}&pagenum={PAGE}&pagesize=100&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq&needNewCode=0
```

建议请求头：

```text
Referer: https://y.qq.com/n/ryqq_v2/singer_list
User-Agent: Mozilla/5.0
```
