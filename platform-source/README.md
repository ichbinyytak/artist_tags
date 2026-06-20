# Platform Source

This folder keeps the compact platform-source package and the rules for fetching
platform data on demand.

It does not keep full QQ / NetEase platform source databases and does not keep
monthly refresh tables. Platform data is kept only when it is needed for normal
lookup, or documented so it can be regenerated in real time later.

## Kept Name Data

- `data/name-source/artist-name-source.json`
- `data/platform-source/qq-v8-artist-name-source.json`
- `data/platform-source/netease-artist-name-source.json`

The unified name source is the main lookup file. Use it when you need to find an
artist name from an `artist_key`.

Rows keep only lightweight name fields:

- `artist_key`
- `qq_artist_id`
- `qq_artist_mid`
- `netease_artist_id`
- `primary_name`
- `names`
- `qq_names`
- `netease_names`

The compact QQ and NetEase files are retained only as platform-specific source
references. They do not include fan counts, song counts, album counts, source
evidence, or monthly metrics.

## Current Name Stats

- Tagged artist rows with names: `63388`
- QQ name source rows: `57714`
- NetEase name source rows: `15553`
- Tagged QQ IDs found in source: `57714 / 57714`
- Tagged NetEase IDs found in current NetEase stats source: `15553 / 39864`

Many tagged `wy` IDs came from earlier cross-platform matching but are not
present in the current NetEase stats backup. Those artists still have names
through QQ rows in the unified name source when a QQ overlap exists.

## Rebuild Compact Name Source

Run this from the project root:

```bash
node platform-source/scripts-backup-2026-06-17-before-new-platform-source/build-platform-name-source-from-tags.mjs
```

The script reads:

- `tagging/data/tags/*.json`
- `backup/data/platform-source/qq/v8/database/qq-v8-*-artist-basic.json`
- `backup/data/platform-source/netease/netease-artist-stats-backup.json`

Then it writes the compact final files under `platform-source/data/`.

## Dynamic Stats Policy

The final database no longer stores monthly refresh tables. If a specific
artist needs current platform statistics, fetch them on demand and use them for
that task.

Useful dynamic fields:

- `song_count`
- `album_count`
- `fan_count`
- `updated_at` or `fetched_at`

Stable platform IDs are used only to know where to fetch:

- QQ: `qq_artist_id`, `qq_artist_mid`
- NetEase: `netease_artist_id`

Names, aliases, language, region, gender, and style tags are not monthly stats.
They belong to the final name source and tag tables.

## QQ Stats Source

Required input:

- `qq_artist_mid`

Known lookup location for existing completed artists:

- `data/name-source/artist-name-source.json`

Endpoint:

```text
POST https://u.y.qq.com/cgi-bin/musicu.fcg
```

Request module:

```text
module: music.web_singer_info_svr
method: get_singer_detail_info
param: { singermid: <qq_artist_mid> }
```

Field mapping:

- `data.total_song` -> `song_count`
- `data.total_album` -> `album_count`
- `data.singer_info.fans` -> `fan_count`

Reference script:

- `scripts-backup-2026-06-17-before-new-platform-source/stats/qq/build-qq-v8-monthly-full.mjs`

This script was originally used for full-table monthly refresh. For future use,
treat it as a reference for endpoint, request payload, headers, retry/progress
behavior, and field mapping. Do not use it to recreate fixed monthly tables
unless that policy changes.

## QQ Artist Discovery

If a new artist does not already have a QQ ID or MID, first search or rebuild QQ
artist source data. The current final package does not keep a full QQ v8
artist-basic crawler.

Known QQ v8 singer-list endpoint used for raw tag snapshots:

```text
GET https://c.y.qq.com/v8/fcg-bin/v8.fcg
```

Important query parameters:

- `channel=singer`
- `page=list`
- `key=<bucket key>`
- `pagenum=<page>`
- `pagesize=<page size>`
- `platform=yqq`

Important fields from returned rows:

- `Fsinger_id` -> `qq_artist_id`
- `Fsinger_mid` -> `qq_artist_mid`
- `Fsinger_name` -> name
- `Fsinger_tag` -> raw QQ tag IDs

Reference script:

- `scripts-backup-2026-06-17-before-new-platform-source/qq/download-qq-v8-artist-tags.mjs`

## NetEase Stats Source

Required input:

- `netease_artist_id`

Known lookup location for existing completed artists:

- `data/name-source/artist-name-source.json`

Stats endpoints used before:

```text
GET https://music.163.com/api/artist/head/info/get?id=<netease_artist_id>
GET https://music.163.com/api/artist/top/song?id=<netease_artist_id>
GET https://music.163.com/api/v1/user/detail/<user_id>
```

Headers:

```text
Referer: https://music.163.com/
User-Agent: Mozilla/5.0
```

Field mapping:

- `head.data.total_song` -> `song_count`
- fallback `head.data.artist.musicSize` -> `song_count`
- fallback `top/song.songs.length` -> `song_count`
- `head.data.total_album` -> `album_count`
- fallback `head.data.artist.albumSize` -> `album_count`
- `head.data.user.userId` -> `user_id`
- `user/detail.profile.followeds` -> `fan_count`

Reference script:

- `scripts-backup-2026-06-17-before-new-platform-source/stats/netease/build-netease-monthly-from-stats-backup.mjs`

That script transforms an existing NetEase stats snapshot. The direct endpoint
rules above came from the previous remaining-artist fetch workflow and should be
used if fresh NetEase stats are needed for individual artists.

## NetEase Artist Discovery

If a new artist does not already have a NetEase ID, search NetEase by name:

```text
GET https://music.163.com/api/search/get/web?type=100&s=<query>&limit=<n>&offset=0
```

Use the result only after identity verification. Same-name artists are common.

## On-Demand Add Flow

1. Search final name source.
2. If found, use platform IDs from the name source or formal index.
3. Fetch current platform stats only if needed.
4. If the artist is not in final tag tables, create a new tag input sample.
5. Run the tagging workflow.
6. Merge only rows with non-empty `style_codes`.
7. Rebuild the formal index and compact name source.

No monthly table is required for this flow.
