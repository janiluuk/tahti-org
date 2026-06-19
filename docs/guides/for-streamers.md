# Tahti for streamers (going live)

This guide is for **broadcasting live audio** to your Tahti channel. If you only upload archive files and never go live, you can skip most of this.

**You need:** Tahti account, verified email, active **Tahti ry membership** (€40/year support), and broadcasting software (OBS Studio is the usual choice).

---

## The idea in one sentence

Your app (OBS, Mixxx, …) sends audio to Tahti’s **RTMP** server using a **secret stream key**; Tahti turns that into a **live** stream and **HLS** playout on `/c/your-slug`.

---

## 5-minute first broadcast (OBS)

### 1. Get credentials

1. Log in → `/dashboard`.
2. Open **Stream settings** (or **Your channel** + stream block).
3. Copy:
   - **RTMP server** (e.g. `rtmp://…/live`)
   - **Stream key** (long string — **never** share publicly)

Treat the stream key like a password. If it leaks, rotate it in the dashboard.

### 2. Paste into OBS

1. OBS → **Settings** → **Stream**.
2. Service: **Custom**.
3. Server: paste RTMP server.
4. Stream key: paste key.
5. **Apply** → **OK**.

### 3. Audio settings (good defaults)

| Setting | Value |
|---------|--------|
| Sample rate | 44.1 kHz |
| Channels | Stereo |
| Audio bitrate | 128–192 kbps AAC |

See [obs-and-broadcasting-guides.md](../obs-and-broadcasting-guides.md) for screenshots and video-bitrate fields (OBS still wants a video track — often a static image).

### 4. Go live

1. In OBS, click **Start Streaming**.
2. Wait ~5–15 seconds.
3. Open `/c/your-slug` in another tab — status should show **Live**.
4. Press play; you should hear yourself (with delay).

### 5. Stop

1. OBS → **Stop Streaming**.
2. Channel goes **Offline**; listeners may hear archive shuffle/fallback if configured.

---

## Other software (same credentials)

| Tool | Guide depth |
|------|-------------|
| **OBS Studio** | [Full OBS walkthrough](../obs-and-broadcasting-guides.md) |
| **Mixxx / Traktor / VirtualDJ** | Use RTMP or Icecast fields from dashboard (Icecast: server + mount + password) |
| **butt** (Icecast) | Minimal DJ streamer — Icecast block on dashboard |
| **FFmpeg** | Power users — RTMP URL + key on command line |

The dashboard shows **RTMP** and **Icecast** blocks; use the block that matches your app’s docs.

---

## Weekly broadcast limits (important)

Tahti tiers cap **live hours per week** (fair use on owned hardware):

| Tier | Rough limit |
|------|-------------|
| FREE | 1 hour / week |
| ARTIST (member) | More hours (see dashboard banner) |
| STUDIO | Highest cap + multistream extras |

The dashboard shows **warnings** (e.g. 45 / 55 minutes) and may **stop** the stream when you hit the cap, with a short **grace** if you disconnect right at the limit.

**Plan:** Shorter regular shows beat one 8-hour marathon unless you are on Studio tier.

---

## Multistream (YouTube, Twitch, Kick, Facebook, …)

Tahti can **simulcast** your live show to other platforms while you only stream to Tahti from OBS.

1. Dashboard → **Multistream (simulcast)** → **Add destination**.
2. Choose **YouTube**, **Twitch**, **Kick**, **Facebook**, **TikTok**, **Mixcloud**, **Instagram** (RTMP), or **Custom**.
3. Paste the **stream key** from that platform’s creator dashboard (see **[multistream guide](multistream-simulcast.md)** or `/help/multistream` in the app).
4. Keep **Active** checked, then go live on Tahti as usual.

**Important:** You paste each site’s **stream key**, not a Tahti API key and not YouTube/Twitch OAuth app credentials.

**Studio tier:** “Always mirror” can push to all targets automatically. Other tiers: toggle **Active** per destination before each show.

Supported ingest URLs are configured for you (e.g. `rtmp://live.twitch.tv/app` + your Twitch key). **Custom** is for any other RTMP service — you fill in both URL and key.

---

## After the show: archive

When auto-archive is enabled for your setup, ending a broadcast can create an **archive item** (processed in the background). It then appears on your channel for replay and downloads.

You can also **upload** files manually under Dashboard → **Archive**.

---

## Stream health checklist

| Check | Good sign | Bad sign |
|-------|-----------|----------|
| OBS bottom bar | Green, no dropped frames | Red “dropped frames” |
| Dashboard channel status | **Live** | Stuck Offline while OBS says streaming |
| Listener player | Sound after ~15 s | Infinite loading |
| CPU | Moderate | 100% — lower OBS preset |

**Common fixes:**

- Wrong stream key → copy again from dashboard.
- Firewall blocking outbound RTMP → allow OBS on network.
- Sample rate 48 kHz vs 44.1 kHz mismatch → set OBS to 44.1 kHz.
- No audio in OBS → check **Audio Input Capture** source and meters moving.

---

## Listener experience (what they see)

You do not need to manage this, but it helps to know:

- Listeners open `/c/your-slug` (no account).
- They use **public chat** with a nickname.
- **Fan chat** is separate — only for logged-in fans with `FAN_CHAT` perk.
- **Announcements** you post in the dashboard appear above chat.

Share **“Live now”** with the channel URL, not the raw RTMP URL.

---

## Security habits

1. Never post your **stream key** in Discord/Twitter DMs.
2. Rotate the key if you suspect a leak (dashboard stream settings).
3. Log out on shared computers after using `/dashboard`.

---

## When something fails

| Symptom | Likely cause |
|---------|----------------|
| OBS connects but Tahti not Live | Wrong key; wrong server path; cap already used |
| Live but silent | OBS not sending audio source; mute button on source |
| Kicked off mid-set | Weekly cap or orchestrator stop — read dashboard usage |
| Fans say chat broken | Rare — Centrifugo/network; try refresh |

For tool-specific fields, always prefer the copy-paste values on **your** dashboard over generic examples in docs.

---

## Related guides

- [For artists](for-artists.md) — profile, releases, fan tiers  
- [For viewers](for-viewers.md) — what listeners do  
- [OBS detailed guide](../obs-and-broadcasting-guides.md)  
- [All guides index](README.md)
