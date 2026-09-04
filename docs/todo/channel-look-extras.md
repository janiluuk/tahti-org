# Channel look-extras persistence

Merged: [tahti-org#435](https://github.com/janiluuk/tahti-org/pull/435) → `main`.

## Goal

Persist Channel Designer look extras that Nuclear previously kept only in
`localStorage` (`tahti.channelLookExtras.{slug}`) on the Channel model so
owner GET/PATCH and public channel/profile responses round-trip them.

## Status

Shipped on `main` (2026-09-04). Deploy prod next so migration
`20260904030000_channel_look_extras` runs. Nuclear client already sends
look extras on PATCH (`0.0.71`). Keep localStorage as cache until all envs
have the migration.
