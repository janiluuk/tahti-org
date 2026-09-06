# Member badge on public artist profiles

**Status:** in progress on `cursor/member-badge-profiles-61fc`.

## Goal

Show that an artist is a **Tahti ry member** (association `User.isMember`) on
their public profile. Join-date copy currently says “Member since …” for every
artist, which collides with constitution terminology (member = €40/yr support
for the cooperative, not “has an account”).

## Plan

1. Add `isMember` to public profile and public channel user payloads.
2. `@tahti/ui` `MemberBadge` — “Tahti ry member”, cyan pill, not Pro/Premium.
3. Render next to the display name on `/u/[username]` (`ProfileHero`) and
   `/c/[slug]` identity.
4. Rename join-date labels to “Joined …” so they no longer say Member.
5. Tests: API round-trip for member vs free-tier artist; UI render.

## Out of scope

- Discover/directory cards
- Exposing `memberNumber` (register data)
- Binding membership benefits copy in studio (already exists)
