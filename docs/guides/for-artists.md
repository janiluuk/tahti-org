# Tahti for artists (members & studio)

This guide is for **you** if you joined Tahti ry, have a **channel**, and want a profile, releases, fan support, and (optionally) live broadcasting. Broadcasting itself is in **[For streamers](for-streamers.md)**.

---

## Before you start

1. **Sign up:** `/join` → verify email (`/verify` link in mail).
2. **Pay membership:** €40/year on `/dashboard` when prompted (Tahti ry member — unlocks full studio and lossless rules for your listeners when you are a member).
3. **Log in anytime:** `/login` → `/dashboard`.

You get one **channel** (slug) and one **username** for your public profile.

---

## Your important links

Copy these from the dashboard **Your channel** section:

| Link | Use when |
|------|----------|
| `/c/your-slug` | “I’m live” or “listen to my archive” |
| `/u/your-username` | Bio, releases, main link in bio |
| `/u/your-username/subscribe` | Patreon-style fan tiers |
| `/r/release-slug` | One link for Spotify/Bandcamp buttons |

---

## Dashboard tour (what each block does)

Open `/dashboard` after login.

| Section | What it does |
|---------|----------------|
| **Tahti ry membership** | Pay €40/year or **Manage billing** (Stripe portal when enabled). |
| **Your channel** | Live/offline status, link to public channel, broadcast time warnings. |
| **Stream settings** | RTMP server, stream key, Icecast mount — for OBS/Mixxx ([streamers guide](for-streamers.md)). |
| **Multistream** | Mirror live to YouTube, Twitch, Kick, Facebook, TikTok, Mixcloud, Instagram (RTMP), or custom — paste each platform’s **stream key** ([guide](multistream-simulcast.md)). |
| **Announcements** | Pinned notes at top of chat on your channel. |
| **Fan subscriptions** | Stripe Connect + fan tiers + perk codes. |
| **Releases** | Draft/publish releases + **DSP URLs** for smart links. |
| **Archive** | Upload recordings; they appear on `/c/your-slug`. |

---

## Step-by-step: look good in public

### Profile

1. Share `/u/your-username` on Instagram, Linktree, etc.
2. Visitors see your display name, bio, releases, and link to the channel.

### Releases & smart links

1. Dashboard → **Releases** → **Add draft** (title + tracks metadata in v1).
2. Click **Publish** when ready (needs at least one track).
3. Click **DSP URLs** on a published release → paste Spotify, Bandcamp, Apple Music, etc.
4. Share **`/r/your-release-slug`** — fans see buttons for each service.

### Embed on your website

- Release player: `/embed/r/release-id`
- Channel mini-page: `/embed/c/your-slug`

---

## Step-by-step: fan subscriptions (money from fans)

### 1. Turn on Stripe Connect

1. Dashboard → **Fan subscriptions**.
2. If you see “Connect payouts”, complete **Stripe Express** onboarding (ID + bank).
3. Wait until **payments ready** (Stripe enables charges on your account).

### 2. Create tiers

Example tiers (you choose names and prices):

| Tier | Price | Example perks (one per line) |
|------|-------|------------------------------|
| Backer | €5/mo | Early access |
| Supporter | €3/mo | `FAN_CHAT` |
| Patron | €10/mo | `FAN_NEWSLETTER`, `FLAC` |

**Special perk codes** (type exactly):

| Code | Effect |
|------|--------|
| `FAN_CHAT` | Active fans can use **fan-only chat** on `/c/your-slug`. |
| `FAN_NEWSLETTER` | Lets you send newsletter to **fans only** (API: `audience: "fans"`). |
| `FLAC` | Fans get lossless downloads where the platform supports it. |

Free-text perks are shown on the subscribe page; only the codes above **turn on** platform features.

### 3. Share subscribe page

Link: `/u/your-username/subscribe`

Fans pay monthly via Stripe. You receive payouts minus Stripe fees and a **2% operational fee** (documented in [engagement-and-fansubs.md](../engagement-and-fansubs.md)).

### 4. When a fan cancels

They keep perks until the **billing period ends**, then about **7 days grace**. You do not need to do anything — status updates automatically.

---

## Step-by-step: archive (not live)

1. Dashboard → **Archive** → upload a file (WAV/MP3 etc. per current upload UI).
2. Wait until processing finishes (worker transcodes).
3. Item appears on `/c/your-slug` for playback and downloads.

Downloads from fans can count toward **engagement** for annual grants (see transparency docs).

---

## Step-by-step: chat & community

1. **Announcements:** Dashboard → type a short pinned message (e.g. “New EP Friday”).
2. **Public chat:** Automatic on `/c/your-slug`; moderate by banning via API/tools as they ship.
3. **Fan chat:** Add `FAN_CHAT` to a tier; active fans see the extra panel when logged in.

---

## Member governance

Paid Tahti ry members can use `/governance` for motions and votes (cooperative decisions). This is separate from fan subscriptions.

---

## What is still rough / API-only

Check [future-improvements.md](../future-improvements.md) for the live backlog. Notable today:

- **Newsletter UI** on dashboard may be limited — drafts/sends exist in the API.
- **Full release audio pipeline** (upload WAV → auto derivatives everywhere) is still growing; v1 focuses on metadata + smart links.
- **DSP distribution** (automatic Spotify upload via Revelator, etc.) is not the same as smart-link buttons.
- **Release ops (planned, M30):** MusicBrainz entry submission, ISRC/UPC, credits, and a release checklist — see [project-roadmap.md](../project-roadmap.md#phase-6b--release-ops--catalog-metadata-m30).

---

## Checklist: “I’m ready to promote my Tahti”

- [ ] Email verified, membership active
- [ ] Stripe Connect **payments ready**
- [ ] At least one **fan tier** active (optional)
- [ ] **Published** release with **DSP URLs** (optional)
- [ ] Tested **one live show** ([streamers guide](for-streamers.md))
- [ ] Link in bio: `/u/username` or `/c/slug`

---

## Troubleshooting

| Problem | What to check |
|---------|----------------|
| Subscribe disabled for fans | Connect onboarding incomplete or `charges_enabled` false. |
| No fan chat | Tier must include `FAN_CHAT` and fan must be logged in + subscribed. |
| Smart link empty | Publish release + save DSP URLs in dashboard. |
| “Weekly limit” on newsletter | FREE = 1 send/week, ARTIST = 4, STUDIO = unlimited. |
| Broadcast stopped suddenly | Weekly hour cap — see usage banner on dashboard. |

---

**Next:** [For streamers](for-streamers.md) · Detailed OBS: [obs-and-broadcasting-guides.md](../obs-and-broadcasting-guides.md) · [For viewers](for-viewers.md)
