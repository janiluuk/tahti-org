# Loading indicators for queue items + playable entities

Status: open, not started.

## Request

Show a loading indicator on queue items when they start loading, and on
any other playable entity (track rows, cover-art play buttons, etc.)
while their audio is buffering/starting — not just the main player bar.
Reuse the existing loading-spinner component from the component
showcase ("storybook") rather than inventing a new one.

## Existing state

- No shared/reusable loading-spinner component exists yet.
  `packages/ui/src/brand/WaveformPlayer.tsx` has a `.waveform-player__spinner`
  CSS class used inline in two places (lines ~304, ~398) — the closest
  existing pattern, but it's local to that one component, not exported
  for reuse.
- This repo has no actual Storybook (`.storybook/`, `*.stories.tsx`) —
  checked, none exist. The closest equivalent is the
  `/dev/components` playground route
  (`apps/web/src/app/dev/components/{page,playground-demos,playground-composites}.tsx`),
  which doesn't currently include a loading/spinner demo either.
- `apps/web/src/components/mini-player/queue-thumb.tsx` (`QueueThumb`,
  the play-queue/history thumbnail row) has no loading state at all
  today — `onPlay` just fires, no visual feedback while the track loads.
- Other playable entities that would need the same treatment: track rows
  in `_tracks-tab.tsx` (`.prof-collection-cover-play` overlay button, see
  [[discography-track-row-unify]]), the main mini-player bar itself, and
  presumably collection/release rows — full inventory not yet done.

## To figure out before implementing

- Whether "loading" here means the player's actual buffering state
  (`usePlayer()` / `player-context.tsx` — check what state it already
  exposes, e.g. `isBuffering` / `isLoading`) or just the gap between
  click and audio start.
- Extract `.waveform-player__spinner` (or build fresh) into a shared
  `packages/ui` component so every playable surface uses the same visual,
  then add a demo of it to `/dev/components` so there's an actual
  "storybook" entry to point at next time.
