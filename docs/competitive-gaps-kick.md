# Tahti vs Kick.com — obvious shortcomings & backlog

Reference: [Kick](https://kick.com), an Australian live-streaming platform operated by
Kick Streaming Pty Ltd, backed by online casino operator Stake and streamer
Trainwreckstv. Kick is **live-stream-first** and venture-backed/commercial; Tahti is
**channel-first** (24/7 live → archive fallback) and nonprofit. This doc lists gaps
artists/viewers will notice when comparing the two, and what closing them would take.

**Status:** docs-only. Basic Kick integration (profile link + live-channel embed) shipped
alongside this doc — see "What's now built" below.

---

## Where Tahti is already stronger (context)

| Area | Tahti | Kick |
|---|---|---|
| Ownership/economics | Member-owned nonprofit (yhdistys); surplus → engagement grants | VC-backed, owned in part by an online casino operator |
| Content policy | Standard community guidelines, board-governed | Explicitly looser than Twitch on gambling, copyright, and harassment; gambling streams permitted (with age verification since Feb 2025) |
| Governance | Public ledger, member voting on policy | Standard commercial ToS, no member governance |
| Archive-first | Every broadcast automatically archives with metadata, tracklist, RSS | VOD/clips exist but the platform's core identity is live-only; archived content isn't the product |
| Open source | AGPL, forkable | Closed platform |
| Direct fan support | Fan-subs go straight to the artist, nonprofit fee structure | 95/5 subscription split (industry-leading among for-profits) but still a for-profit intermediary |

These don't remove the gaps below — artists choosing between the two will still weigh
Kick's audience size, monetization ceiling, and live-streaming polish against Tahti's
mission and archive/broadcasting model.

---

## What's now built (this pass)

- **Kick channel link** — a dedicated "Kick channel URL" field in Settings → Artist Info
  (Streaming platforms panel), alongside YouTube/hearthis.at/Twitch/SoundCloud. Renders
  with a Kick icon in its own "Streaming platforms" section on both the channel page
  (`/c/[slug]`) and profile page (`/u/[username]`) — this is the "artist bio link" ask.
- **Kick live-channel embed** — when a Kick URL is set, both pages also render a
  `player.kick.com/{username}` iframe under a "Live on Kick" section, so viewers can watch
  the artist's Kick stream without leaving Tahti. No API call needed — Kick's embed URL is
  directly derivable from the username in the profile link, unlike SoundCloud (which needs
  an oEmbed round-trip for title/thumbnail metadata).

---

## 1. Revenue split and monetization ceiling

### Kick

- **95/5 subscription split** across all tiers (creator keeps ~$4.74 of a $4.99 Tier 1
  sub) — the platform's headline pitch, versus Twitch's standard 50/50.
- **Kicks** (virtual currency) for tipping/gifting during streams, shown in chat.
- **Multistream program**: streamers can simulcast to other platforms and keep 50% of the
  Kick-attributed ad/sub revenue from that simulcast.
- Ads began rolling out April 2026, described as designed to stay non-intrusive.

### Tahti today

Fan-subs go to the artist with a nonprofit operational fee, not a for-profit revenue
split — different model, not a strict apples-to-apples comparison. No in-chat
tipping/gifting currency exists on Tahti.

### Should consider

- [ ] In-chat tip/gift flow tied to the existing fan-sub/Stripe pipeline (not a new
      virtual currency — Tahti's nonprofit framing argues against a token system)
- [ ] Clarify in artist-facing docs how Tahti's take-rate compares to Kick's 95/5, since
      that's the number artists will be told to compare

## 2. Discovery algorithm

### Kick

Rolled out a "V1 discovery algorithm" in April 2026 (to ~10% of users at time of
rollout) that tracks chat-to-viewer engagement ratio rather than raw viewer count, and
promotes "High-Heat" streams on the homepage — explicitly built to reduce reach for
channels with inflated/bought engagement.

### Tahti today

`/listen` has genre filtering (shipped this session) but no engagement-weighted discovery
surface — channels are presumably listed by live status/recency, not by real audience
engagement quality.

### Should consider

- [ ] A "currently engaged" or chat-activity-weighted sort option on `/listen`, distinct
      from pure listener count, to surface genuinely active rooms over inflated ones —
      fits Tahti's anti-gaming, community-first framing well

## 3. Mobile app

### Kick

Announced a ground-up mobile app rebuild in April 2026, explicitly targeting latency and
usability parity with Twitch's mobile app.

### Tahti today

No dedicated mobile app — web-only (responsive, per `docs/design-audit-2026-07.md`, but
not a native/PWA experience).

### Should consider

Out of scope for a doc-only backlog item — a native or PWA mobile app is a
multi-month project, not a quick gap-close. Flagging for the roadmap, not proposing here.

## 4. Chat maturity

### Kick

Self-described as "simpler but rapidly improving" compared to Twitch's more mature
emote/extension ecosystem. Kicks-based gifting is integrated into chat.

### Tahti today

Per-channel live chat exists (a genuine Tahti strength vs. most competitors per the
hearthis.at gap doc), but no emote system, no extensions/bot ecosystem.

### Should consider

Not an urgent gap — Kick's own chat is described as behind Twitch's, so Tahti isn't
behind the leader here. Emotes would be a nice-to-have, not a competitive necessity.

---

## Explicitly not chasing

Kick's headline differentiators — permissive gambling content, casino-operator
backing, VC-funded ad monetization — are not things Tahti should emulate; they conflict
directly with the nonprofit, member-governed model that's Tahti's actual competitive
position. This doc is about UX/feature gaps (discovery, monetization mechanics, mobile),
not about becoming Kick.
