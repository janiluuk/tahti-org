# "Your feed" section redesign (`/listen`)

Status: implemented in PR (unified `FeedCard` + new `Reveal` disclosure component); awaiting manual browser check.

## Reported problem

`apps/web/src/app/listen/_your-feed-section.tsx` (the "Your feed" section
on `/listen`, signed-in listeners only — follows/releases/posts from
artists you follow):

- Card boxes are inconsistent (`feed-hero__main` banner cards vs.
  `feed-hero__aside` updates list render very differently sized/shaped
  boxes for what's conceptually the same kind of item).
- Cover images (`feed-banner__cover`, background-image div) get cut off.
- The actual message/teaser text (`feedTeaser`) is not readable — likely a
  contrast or truncation/overflow issue in `feed-banner__body` /
  `feed-updates-row__teaser` (need to check the CSS these classes resolve
  to — search `packages/ui/src/styles/*.css` for `.feed-banner` /
  `.feed-updates`).

## What's wanted

An alternative version of the section with:

- Different, unified styling across all announcement/feed items — one
  consistent card shape regardless of item kind (post/release/track),
  instead of the current banner-vs-updates-list split.
- Items should use a "reveal" component/interaction (progressive
  disclosure — collapsed by default, expands in place) rather than the
  current ad-hoc `expanded`/`Read more` toggle in `FeedBannerCard` and the
  separate `FeedPostModal` popup. No existing `Reveal` component exists in
  the repo yet (checked `packages/ui/src`, `apps/web/src/components`) —
  this needs to be built, or an equivalent existing disclosure pattern
  elsewhere in the design system should be reused if one fits.

## Scope / not yet investigated

- Whether `apps/u/[username]/page.tsx`'s own (separate, currently-empty
  in the profile-header "Feed" card) feed section shares any of this
  styling or is a fully separate implementation — only `/listen`'s
  `_your-feed-section.tsx` was named by the report.
- Exact CSS root cause for the image-cropping and low-contrast text —
  not diagnosed yet, just reported symptoms.
- Data shape (`FeedItem` from `@tahti/shared`, served by
  `apps/api/src/routes/me/feed.ts`) is presumably unchanged; this is a
  presentation-layer redesign, not a data/API change, unless investigation
  finds otherwise.
