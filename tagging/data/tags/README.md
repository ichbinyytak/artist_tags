# Artist Light Tag Tables

This directory stores the formal lightweight artist tag result tables.
Only artists with non-empty `style_codes` are retained in these formal result
tables. Artists without usable style tags were pruned from this directory.
If a new artist appears later, search and match that artist separately before
adding it to a formal tag table.

Formal artist rows only keep:

- `artist_key`
- `gender_code`
- `region_code`
- `language_codes`
- `style_codes`

Names, aliases, raw platform tags, source URLs, evidence text, review notes,
and monthly metrics stay outside these formal tag tables.

## Current Formal Tables

- `cn-artist-light-tags.json`
- `western-artist-light-tags.json`
- `japan-artist-light-tags.json`
- `korea-artist-light-tags.json`

## Current Status

- CN: `28291` retained rows, merged from QQ v8 and NetEase.
- Western: `14688` retained rows, merged from QQ v8 and NetEase.
- Japan: `10495` retained rows, merged from QQ v8 and NetEase.
- Korea: `9914` retained rows, merged from QQ v8 and NetEase.

All retained rows have at least one `style_codes` value.

NetEase rows were merged into these four regional tables by `wy` artist ID.
The pre-merge NetEase light tag source is archived at
`temp1/tag-source-research/merged-source/netease-artist-light-tags.before-merge.json`.
