# QQ Direct Search Overlap Method

## What This Is

This backup preserves the current effective method we used to expand the QQ/Netease overlap artist base.

This method is useful because:

- It starts from the QQ raw artist base, sorted by fan count.
- It removes already-overlapped QQ artists first.
- It searches Netease artist results directly using QQ artist names.
- When the returned Netease artist looks obviously like the same person, it writes that pair into the overlap base.

This turned out to be very practical for recovering many true overlaps that were missing from stricter matching rules.

## Core Script

- `augment-overlap-from-qq-direct-search.mjs`

## Main Idea

1. Build a QQ non-overlap list.
2. Sort by QQ fan count descending.
3. Search Netease artist search using QQ name / alias / name keys.
4. Score candidates.
5. If the top candidate is an obvious same-person match, write it into `database/overlap-artist-base.json`.
6. Repeat in rounds:
   first round on all QQ artists,
   then rebuild non-overlap list,
   then run another round.

## Why It Works

- High-fan QQ artists often do exist on Netease, even when previous overlap rules missed them.
- Direct search is noisy, but still useful when combined with a conservative "obvious match" gate.
- Running multiple rounds helps because each round shrinks the remaining QQ non-overlap pool.

## Important Notes

- This method is valuable as a backup workflow and should be kept.
- Progress/report files can become corrupted if interrupted mid-write, so atomic writes are important.
- Running multiple copies of the script at once can cause write conflicts; keep only one main process.
- The overlap base format must remain consistent with the existing structure:
  `identity`, `genres`, `tags`, `platforms`, `match`.

## Typical Inputs

- `database/qq-artist-base.json`
- `database/overlap-artist-base.json`
- `temp2/qq-artist-non-overlap-by-fans.json`

## Typical Outputs

- `database/overlap-artist-base.json`
- `temp2/qq-direct-search-overlap-progress.json`
- `temp2/qq-direct-search-overlap-report.json`

## Suggested Usage

1. Rebuild `temp2/qq-artist-non-overlap-by-fans.json` from the latest overlap base.
2. Run this script on the new non-overlap list.
3. After completion, rebuild non-overlap again.
4. Run another round if needed.

## Why We Keep This Backup

Because this method is not just an experiment.
It already proved that it can add a large number of missing overlap pairs quickly.
It should remain available as a reusable recovery/expansion path for future overlap rebuilding.
