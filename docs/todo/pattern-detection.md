# Pattern detection (engagement anti-fraud)

**Status:** partial

Four marketed detectors (batch accounts, even intervals, network clusters,
reciprocal rings) as heuristic flags for board review — no silent docking.

## Done in this branch

- [x] `packages/ledger/src/pattern-detection.ts` + Vitest
- [x] Grant preview anomaly codes extended; `collectPatternFlags` in
      `buildGrantPreview`
- [x] Daily `pattern-fraud-scan` on `light-daily` → `PATTERN_FRAUD_ALERT`
- [x] Shared `GrantAnomalySchema` + cron subTasks / worker dispatch
- [x] Docs: engagement anti-fraud + DECISIONS row
- [x] Product docs: `about.md`, `features.md` (honest grants + pattern detection)

## Leftovers

- [x] Artist notification when a channel is flagged (`PATTERN_FRAUD_FLAGGED`, FI + EN, links to Help)
- [ ] Formal appeal workflow
- [ ] Threshold tuning after real production data
- [ ] Player board UI to surface `anomalies` (sibling tahti-player PR)
- [x] Marketing `website/index.html` — dropped “(building)”; four detectors + human-review copy
