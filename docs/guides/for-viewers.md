# Tahti for viewers (listeners & fans)

You do **not** need an account to listen or to use public chat. You only need an account if you want to **subscribe** to an artist, join **fan-only chat**, or get **supporter perks** (extra downloads, FLAC, etc.).

---

## 1. Find a show

1. Open the link the artist shared. It usually looks like one of these:
   - **Live channel:** `https://tahti.live/c/artist-slug`
   - **Profile:** `https://tahti.live/u/artist-username`
   - **Release / smart link:** `https://tahti.live/r/release-slug`
2. On the **channel** page you see the player, archive list, and chat on the side.
3. On the **profile** you see releases and a link to their channel and subscribe page.

**Tip:** Bookmark the channel URL if you come back often.

---

## 2. Listen live

1. Go to `/c/artist-slug`.
2. If the artist is **Live**, press play on the stream (HLS in the browser).
3. If they are **Offline**, you may still hear **archive** mixes from past shows in the list below the player.

**Why is there a delay?** Live web audio is often 10–30 seconds behind the DJ’s room. That is normal.

**Sound quality:** Free streams are MP3-class quality. Artists who are Tahti members can offer higher quality to supporters (see fan subscribe below).

---

## 3. Chat (public) — no account

1. On the channel page, find **Chat** on the right.
2. Type a **handle** (nickname) and click **Join**.
3. Type a message and press Enter or **Send**.

**Rules of thumb:**

- Keep messages short and friendly.
- The artist can ban abusive handles.
- If you are logged in and pay that artist as a fan, your messages can show a small **supporter** badge.

---

## 4. Fan-only chat (subscribers only)

Some artists offer a separate **Fan chat** below public chat.

1. You must be **logged in** (`/login`).
2. You must have an **active fan subscription** to that artist.
3. Their tier must include the perk code **`FAN_CHAT`** (artists set this when creating tiers).

If you qualify, fan chat connects automatically when you open the channel. If you do not, you will only see public chat.

---

## 5. Support an artist (fan subscription)

1. Open `/u/artist-username/subscribe`.
2. Read the tiers (price and perks).
3. Click **Subscribe** on a tier → Stripe Checkout (card payment).
4. After payment you are a **fan subscriber** until you cancel.

**What you might get** (depends on what the artist listed):

| Perk code (artist sets) | What it usually means |
|-------------------------|------------------------|
| (any active sub) | Supporter badge in public chat |
| Unlimited / download perks | Heavier-weight downloads on their tracks and archive |
| `FLAC` | Lossless download option where available |
| `FAN_CHAT` | Fan-only chat room |
| `FAN_NEWSLETTER` | Fan-only email list when the artist sends that way |

**Cancel:** Use your subscription management in Stripe, or the site’s “my subscriptions” when available. Access usually continues until the **end of the paid month**, then a short **grace period** (about 7 days) before perks turn off.

**Money:** Payment goes to the artist via Stripe; Tahti charges a small **operational fee**, not a platform cut of your support.

---

## 6. Smart links (Spotify, Bandcamp, etc.)

Artists can put streaming links on `/r/release-slug`.

1. Open the smart link URL they shared.
2. Tap **Spotify**, **Bandcamp**, or other buttons if listed.
3. If there are no external links, the page offers **Listen on Tahti** → their profile.

---

## 7. Embeds (watch on another site)

Artists can embed players on blogs or social pages:

- Release embed: `/embed/r/release-id`
- Channel embed: `/embed/c/slug`

You use those the same way as on Tahti — play audio in the iframe.

---

## 8. Transparency (where the money goes)

Curious about the cooperative’s finances?

- Open `/transparency` for public ledger summaries.
- Open `/transparency/methodology` for how grants and fees are explained.

This is **org-level** openness, separate from what you pay an individual artist.

---

## Troubleshooting

| Problem | Try this |
|---------|----------|
| Player won’t start | Refresh; check Wi‑Fi; try another browser (Chrome/Firefox). |
| “Live” but no sound | Artist may have stopped sending audio — check back in a minute. |
| Chat won’t connect | Disable strict ad blockers for the site; try again. |
| Subscribe button greyed out | Artist may still be setting up Stripe Connect — try later. |
| Fan chat missing | You need login + active sub + artist tier with `FAN_CHAT`. |

---

## Glossary (one line each)

| Word | Meaning |
|------|---------|
| **Channel** | Artist’s live + archive page (`/c/...`). |
| **Profile** | Artist’s public page with releases (`/u/...`). |
| **Archive** | Recorded sets uploaded or saved after a broadcast. |
| **Fan sub** | Monthly payment directly to one artist. |
| **Smart link** | One link that lists DSP/streaming destinations. |

---

**Next:** Artists should read [For artists](for-artists.md). Going live? [For streamers](for-streamers.md).
