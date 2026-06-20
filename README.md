# Artist Database

It keeps only the pieces needed for normal lookup and future incremental artist
tagging. Full platform source tables, evidence archives, review files, and
temporary build artifacts are kept in the backup area, outside the final
package.

## Included Packages

- `tagging/`: formal artist tag tables, style taxonomy, and scripts
  for adding tags for future new artists.
- `platform-source/`: compact name source for artists retained in the final
  tag tables, plus platform discovery and on-demand stats fetch rules.
- `formal-index/`: compact unified artist index generated from final tag
  tables only.

## Normal Lookup Flow

1. Find names in `platform-source/data/name-source/artist-name-source.json`.
2. Use `artist_key` to query `formal-index/data/formal-index-artist-keys.json`
   if you need platform ID membership.
3. Use `artist_key` to query the four files in `tagging/data/tags/`.
4. Translate `style_codes` with
   `tagging/data/platform-source/qq/v8/dictionaries/standard-style-taxonomy.json`.

## Core Rule

If an artist has no final tag row, it should not be kept in the formal index or
platform name source. Add new artists by searching and tagging them first, then
rebuild the compact final outputs.

Monthly refresh tables are no longer part of the final database. Platform
stats such as song count, album count, and fan count should be fetched on demand
using the rules in `platform-source/`.
