# Formal Artist Index

This folder stores the compact final formal artist index.

The index is a single unified table. It is not split by platform and only keeps
artists that are present in the final formal tag tables.

## Formal Index

- `data/formal-index-artist-keys.json`

Each row keeps only:

- `artist_key`
- `qq_artist_id`
- `netease_artist_id`

Names, aliases, source evidence, merge batches, review notes, monthly metrics,
and platform raw fields are intentionally not stored here.

## Current Stats

- Total indexed artists: `63388`
- With QQ ID: `57714`
- With NetEase ID: `41236`
- QQ + NetEase overlap: `35562`
- QQ only: `22152`
- NetEase only: `5674`

Regional source counts from final tag tables:

- CN: `28291`
- Western: `14688`
- Japan: `10495`
- Korea: `9914`

## Rebuild

Run from the project root:

```bash
node formal-index/scripts/build-formal-index-from-tags.mjs
```

The script reads:

- `tagging/data/tags/cn-artist-light-tags.json`
- `tagging/data/tags/western-artist-light-tags.json`
- `tagging/data/tags/japan-artist-light-tags.json`
- `tagging/data/tags/korea-artist-light-tags.json`

Then it writes:

- `formal-index/data/formal-index-artist-keys.json`

If a future artist is not in the tag tables, do not keep it in this completed
formal index. Search and tag the new artist first, merge it into the completed
tag table, then rebuild this index.
