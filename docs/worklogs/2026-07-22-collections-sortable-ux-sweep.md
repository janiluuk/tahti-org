# Collections drag-reorder UX sweep (2026-07-22)

## Scope

Follow-up to shipping `<SortableList>` (`packages/ui/src/brand/SortableList.tsx`,
`@dnd-kit/react`-based) as the collections grid and collection editor tracklist's
drag-reorder primitive — the last unimplemented item from the Sprint 9 brief.
Audited the surrounding upload + collections surfaces for consistency, dead
code, and stub functionality, then fixed what was in scope.

## Finding: drag-reorder always enabled regardless of `trackSortMode` — fixed

The collection editor's tracklist let you drag-reorder tracks even when the
collection's `trackSortMode` was `NAME` or `TIME`. The reorder endpoint always
persists `position`, but the public page's `sortCollectionItems()`
(`apps/api/src/routes/collections/collections.ts`) recomputes display order
from title/date in those modes and ignores `position` entirely — so dragging
silently did nothing the user could see on their public page.

**Fixed:** `_collection-editor.tsx` now gates the `SortableList` behind
`initial.trackSortMode === 'MANUAL'`. In NAME/TIME mode it renders a static,
non-draggable list sorted the same way the public page sorts it, with a hint
("Track order is set to “By name” — switch Track order to Manual to
drag-reorder.") explaining why dragging is off.

## Finding: fake drag handle glyph, whole-row/whole-card was the actual drag target — fixed

Both the tracklist row and the collections-grid card rendered a decorative
`⠿` glyph but attached `sortable.ref` (the actual drag surface) to the entire
row/card. On the grid this meant the whole `<Link>` — including its
click-to-navigate — was the drag target, with no visible affordance at all.

**Fixed:** wired `sortable.handleRef` to the `⠿` glyph in both places. The
grid card now has a real handle (`.collections-card__drag-handle`, absolute
positioned, `pointerEvents` scoped) with `onClick={(e) => e.preventDefault()}`
so grabbing it doesn't trigger the Link's navigation — confirmed in a real
browser: dragging the handle reorders without navigating, and grabbing
elsewhere on the card still lets a plain click through.

## Finding: reorder failures silently kept the stale optimistic order — fixed, and a real bug found while fixing it

Neither `_collections-grid.tsx` nor `_collection-editor.tsx` checked the
reorder call's result — a failed save left the optimistically-reordered UI
looking successful until the next refresh.

**Fixed:** both now capture the pre-drag order, and revert + show an inline
error (`studio-text-error`) if the persist fails.

**While verifying this in a real browser** (Playwright, not just source
review) with the request intercepted/aborted, the revert didn't fire at all
the first time — `persistOrder`'s only failure check was `!res.ok`, which
never runs when `fetch()` itself throws (a real network failure, not just a
4xx/5xx). That's an unhandled rejection, so the revert code after it never
executes. Wrapped both persist paths in `try/catch` so both HTTP-error and
network-exception failures revert correctly. Re-verified: aborted request →
error message shown → order reverts to pre-drag state, confirmed against the
DB, not just the DOM.

## Bug found and fixed while testing: `SortableList`'s reorder math was wrong

Browser-testing the drag itself (not just typecheck/lint) turned up a real
logic bug in `SortableList.tsx`: `handleDragEnd` computed `fromIndex`/`toIndex`
by matching `event.operation.source.id` and `.target.id` against the items
array. In this @dnd-kit/react version, the default `OptimisticSortingPlugin`
already live-reorders each sortable item's `.index` as the drag hovers over
neighbors — so by drag-end, `source` and `target` report the **same** item at
its **final** settled index. Comparing their ids was always a no-op
(`source.id === target.id` → early return), so **no reorder ever persisted**
via drag — confirmed by DB checks showing `publicProfileOrder`/`position`
unchanged after a drag that visually looked like it worked (the visual change
was purely optimistic client state from `onReorder`, which never actually
fired). This wasn't caught by typecheck/lint/manual code review — only found
by seeding real data, launching both dev servers, and driving an actual drag
with Playwright, then checking Postgres directly rather than trusting the
rendered DOM.

**Fixed:** use `source.initialIndex` (captured at drag start) vs
`source.index` (live-updated, final at drag end) via the `isSortableOperation`
type guard from `@dnd-kit/react/sortable`, instead of comparing ids. Verified
end-to-end afterward: pointer-drag on the grid, pointer-drag on the tracklist,
and **keyboard-driven** reorder (Tab to handle → Space → Arrow → Space) all
now persist correctly, confirmed by querying Postgres after each.

## Finding: no keyboard reorder / no screen-reader support — investigated, no fix needed

Initial static read of `SortableList.tsx` suggested no keyboard path and no
ARIA live-region announcements. Checking `@dnd-kit/dom`'s source directly
showed this is wrong: `defaultPreset` (used automatically since `SortableList`
never overrides `sensors`/`plugins`) includes `KeyboardSensor` and an
`Accessibility` plugin that auto-injects `tabindex="0"`, `role="button"`,
`aria-roledescription="draggable"`, `aria-describedby`, `aria-pressed`, and
`aria-grabbed` onto the handle/element, plus a live region for announcements —
all with zero consumer wiring. Confirmed live in the browser: Tab lands on the
handle, Space/Arrow/Space reorders the tracklist, and the DB reflects the
change. No code change needed; corrected the record here since the concern
was reasonable to raise but didn't hold up under verification.

## Bug found (pre-existing, unrelated to SortableList) and fixed: collection editor page crashed on every visit

While browser-testing, `/dashboard/collections/[slug]` threw
`releases.map is not a function` on load — `fetchMyReleases()` in `page.tsx`
cast the entire `/api/me/releases` response as an array and called `.map` on
it, but that endpoint (`MeReleasePagedListSchema`) always returns a paginated
envelope `{page, limit, total, releases: [...]}`. This crashed the whole page
via Next's error boundary for **every** collection, regardless of my changes —
confirmed via a direct `curl` against the endpoint. Fixed by reading
`data.releases` instead of casting `data` itself.

## Findings noted, not fixed (out of scope)

- **Bandcamp import** (`dashboard/upload/import/bandcamp`) and **SoundCloud
  import** (`dashboard/upload/import/soundcloud`) both dead-end in
  "coming soon" copy after a working OAuth connect — pre-existing, matches
  the 2026-07-12 worklog's note on the SoundCloud side. Bigger job (rate
  limits, format handling, licensing) that deserves its own pass.
- **Heading pattern drift** between `collections/page.tsx` (`Heading`
  component) and the collection editor (raw `<h1>`) — cosmetic, and the raw
  `<h1>` pattern is actually the more common one dashboard-wide, so not a
  convention violation worth chasing.

## Method note

Static review (typecheck, lint, reading library source) caught real things,
but the two most important bugs here — the reorder math being a complete
no-op, and the collection editor page crashing outright — were only found by
actually seeding data, running both dev servers, and driving the feature with
Playwright against a real Postgres instance, then checking the database
directly instead of trusting rendered DOM text. Worth the setup cost.
