> **Status update**: items #1 (partial — heading badge removed), #3, #4,
> and #10 below have been fixed in code (see commit history). Item #6 was
> re-investigated and turned out to be a **false positive**: `isLive`
> rendering on the profile page (`ProfilePageLayout`/`ProfileHero`,
> `prof-live-badge` "ON AIR NOW" + "LIVE NOW" embed CTA) is already
> correctly implemented. The screenshot showed no live badge because the
> demo channel's `state` had already reverted to `OFFLINE` by the time
> that (5th/last) screenshot was captured — see the still-unresolved
> "channel state reverts to OFFLINE" issue noted separately. Re-verify
> with a fresh capture once that root cause is fixed.

# UX audit — live channel, profile, discover, dashboard

Based on fresh screenshots captured against a locally seeded demo channel
(`@screenshot-demo`, set to `LIVE` with injected chat activity). See
`docs/e2e-screenshots/public/channel-live.png`, `.../public/profile.png`,
`.../public/listen.png`, `.../free/listen.png`, `.../artist/dashboard.png`.

## Live channel page (`/c/[slug]`)

1. **Triple "LIVE" indicators competing for attention.** The page shows
   "LIVE" in three different styles simultaneously: a pill in the top
   header (`ch-live`), a green "● LIVE" badge next to the artist name
   (`LiveBadge`), and a sticky bar pinned to the bottom of the viewport
   ("Screenshot Demo Artist is live / Open →"). Same fact, three visual
   languages. Pick one primary treatment (recommend: the header pill) and
   demote or remove the others.

2. **Player copy contradicts the live state.** The player card header
   reads "READY TO PLAY" while the scrubber/play button below it shows
   "LIVE" — two different labels for the same stream right next to each
   other. When `channel.state === 'LIVE'`, the card header should say
   "LIVE NOW" (or similar), not "READY TO PLAY".

3. **Anonymous visitors never actually receive chat — "channel is quiet"
   is misleading.** `apps/web/src/app/c/[slug]/chat-panel.tsx` only opens
   the Centrifugo WebSocket connection once a `token` exists, and `token`
   is only set after the visitor types a handle and clicks "Join"
   (`joinChat`). So a visitor who hasn't joined is not subscribed to the
   channel at all — they'll see "channel is quiet right now — say hi"
   even while messages are actively flowing. This was confirmed in this
   session: 5 chat messages were published via Centrifugo while the
   screenshot page was loaded, and none rendered because the page never
   subscribed. **Fix:** allow read-only/anonymous subscribe to
   `channel:<slug>` (Centrifugo dev config already has
   `allow_subscribe_for_client: true`) so visitors see live chat without
   having to join, and only require a handle/token when they want to
   *post*.

4. **Chat input row is clipped at the viewport edge.** At 1280px width,
   the "Your handle" input + "Join" button in `.ch-chat-input-row`
   overflow past the right edge of the sidebar — "Join" is cut off
   mid-word. Needs a max-width / flex-wrap fix on the chat sidebar.

5. **Archive list has no separation from the live player.** When live,
   "ARCHIVE" / "Live at Klubi — March 2026" sits immediately below the
   live player with the same visual weight, with no heading like "Past
   broadcasts" — reads as if it's part of the live stream.

## Public artist profile (`/u/[slug]`)

6. **No live indication at all**, despite the channel being LIVE — only
   a static "Tune in live" button hints at it (same style whether live or
   offline). This is the opposite extreme from the channel page (#1):
   the profile should carry exactly one clear LIVE badge near the artist
   name, consistent with whatever single treatment is chosen for #1.

7. **"Podcasts & feeds", "Collections", "Releases" sections are bare text
   stacks** — no card backgrounds/borders, unlike every other surface in
   the app (dashboard, channel page) which is built from bordered cards.
   The profile page currently reads as an unstyled placeholder next to
   the rest of the product.

8. Avatar is a flat gradient circle with a single letter ("S") — fine as
   a fallback, but worth confirming this only shows when no avatar is
   uploaded (seed data has none, so can't confirm from this pass).

## Discover / Listen (`/listen`)

9. **Live channel missing for logged-in users right after going live.**
   `apps/web/src/app/listen/page.tsx` fetches
   `${API_URL}/api/v1/channels` with `next: { revalidate: 30 }` (Next.js
   ISR). In this session, the public `/listen` view correctly showed
   "Live now" with `@screenshot-demo`, but `/listen` rendered for a
   logged-in free user — captured seconds earlier in the same run —
   showed "No channels live right now". Both requests hit the same
   shared ISR cache; the first one served a stale pre-seed response.
   Real listeners can see this for up to 30s after an artist goes live.
   Consider on-demand revalidation (`revalidateTag`/`revalidatePath`)
   triggered when a channel's `state` flips to `LIVE`/`OFFLINE`, in
   addition to (or instead of) the time-based window.

10. **Header always shows "Sign in", even when authenticated.**
    `ChannelHeader` (`packages/ui/src/brand/ChannelPageLayout.tsx`) has no
    concept of a logged-in session — it unconditionally renders a
    "Sign in" link whenever `!isLive`. So `/listen`, and any offline
    `/c/[slug]` page, shows "Sign in" for a logged-in free/member user,
    while `/dashboard` correctly shows the user's name + "Log out". This
    is the same header component used across all public-shell pages —
    fixing it once (pass session/user down, render avatar+menu when
    authenticated) fixes `/listen`, `/u/[slug]`, and offline channel
    pages at once.

## Artist dashboard (`/dashboard`)

11. **Same "live indicator overload" as the channel page**: a green "On
    air" pill in the top-right, a "BROADCASTING LIVE" badge under the
    page title, and a separate "LIVE NOW" panel with "End Broadcast" —
    three redundant signals stacked vertically for one fact. Recommend
    collapsing to the "LIVE NOW" panel (it's the one with the actionable
    "End Broadcast" button) plus the header pill; drop the middle badge.

12. Stat cards (Plays/Downloads/Fan subscribers/Revenue) all read 0 —
    expected with fresh seed data, but this dashboard screenshot is also
    used on the public `/for-artists` marketing carousel. Worth seeding
    non-zero demo numbers specifically for that screenshot so the
    marketing page doesn't show an all-zero dashboard.

## Cross-cutting

13. **"LIVE" has at least four different visual treatments** across
    these two pages alone: header pill with dot, green "● LIVE" text
    badge, a bordered "LIVE NOW" panel, and a sticky bottom bar. Worth
    consolidating into a single `<LiveBadge>` component with size
    variants (small/inline, panel) used everywhere instead of four
    bespoke implementations.

## Suggested priority

- **High** (visibly broken, easy to scope): #3 (anon chat never
  subscribes), #4 (chat input clipped), #10 (header ignores session).
- **Medium** (visual consistency): #1/#11/#13 (live-badge consolidation),
  #2 (player copy), #6 (profile missing live badge).
- **Low / polish**: #5, #7, #8, #9, #12.
