# Tahti ry — Tahti Radio meta-stream and venue calendar API

## Tahti Radio — the meta-stream

Tahti Radio is the org-operated 24/7 stream that **relays whichever member
channels are currently live**. It's a discovery surface, not a curated
program.

### What it is

- A single Liquidsoap container running on the  Tahti infrastructure
- At any given moment, it relays the audio from one currently-live member channel
- When the current relay-target stops broadcasting, the meta-stream picks the
  next available live channel (round-robin or random; configurable)
- When zero channels are live, it falls back to a placeholder loop (an
  instrumental track + occasional "we'll be back" voice tag)
- It multistreams out to **Mixcloud Live** only (legally clean target)
- Listeners can tune in at `radio.tahti.fi` or via the player on `tahti.fi`
- Listener-hours on Tahti Radio route to the originating channel's vanity
  counter (not to grant calculation under v6 anyway, since listener-hours are
  cosmetic now — but for honest accounting, the data still attributes correctly)

### What it isn't

- Not a curated radio station. No editorial schedule. The director doesn't
  pick what plays when.
- Not a replay-of-archives stream. Archives don't go through Tahti Radio.
  Only currently-live broadcasts.
- Not multistreamed to YouTube or Twitch. Those platforms strike unlicensed
  music regardless of artist consent. Mixcloud has blanket licenses.

### Why live-only, no curation

Curation would require:
- An editorial role (effectively a radio programmer)
- Consent flows from every artist whose archive plays
- A scheduling system
- A governance answer for "who decides what plays at prime time"

These problems are solvable but they're a real product. Live-only sidesteps
all of them — going live is already a public act, so consent is implicit.
The meta-stream just amplifies that.

### How channel selection works

When the current relay-target stops:

1. Fetch list of channels currently in `LIVE` state from the orchestrator
2. Filter:
   - Channel must have `metaStreamOptOut = false` (default false)
   - Channel must not be in cooldown (just relayed for ≥10 min)
   - Channel must be eligible (member in good standing, not flagged)
3. Sort by:
   - Time since last meta-stream feature (longest first — gives less-known channels a fair shake)
   - Channel state (LIVE > STARTING-but-broadcasting)
4. Pick top. Hand off to Liquidsoap.

The result is roughly: every currently-live channel gets relayed for ~10
minutes at a time, in a fair rotation, with newer/less-broadcast channels
getting slight priority. When only one channel is live, that channel gets
the whole meta-stream until it stops.

### Opt-out

Any artist can disable being on Tahti Radio in their channel settings:

> **Include my live broadcasts on Tahti Radio**
> When enabled, your live broadcasts may be relayed on Tahti Radio (the
> org-operated meta-stream) and multistreamed to Mixcloud. Listeners
> discovering you through Tahti Radio can click through to your channel.
> [toggle: ON / OFF — default ON]

There is no opt-in for archive relay because we don't relay archives.

### Multistream-out to Mixcloud

The meta-stream is multistreamed to Mixcloud Live continuously when it has
audio. The Mixcloud account is `mixcloud.com/tahti-radio`. Stream metadata
("now playing: Artist Name") updates as the meta-stream switches between
sources.

Why Mixcloud only:
- **Legal:** Mixcloud has blanket licenses (PRS, PPL, ASCAP, BMI, etc.) that
  cover broadcasts containing music by third-party artists. DJ mixes are
  legal there.
- **YouTube:** Content ID will strike a stream containing copyrighted music
  even if the broadcasting artist consented. We will lose the account within
  weeks. **Don't do it.**
- **Twitch:** Same as YouTube; their Music DMCA enforcement is real and
  account-terminating. Even if Twitch's music platform launches, it doesn't
  cover the relay use case.
- **Mixcloud:** Right tool for the job. Use it.

If a future legal regime makes YouTube/Twitch viable (e.g. EU legislation
forcing platform-level blanket licensing for collected works), we add them
then. Not before.

### Cost

Modeled in financials at:
- Y1: €200 (mostly Mixcloud Pro account fees + small Liquidsoap container)
- Y2: €800 (Mixcloud Pro + bandwidth)
- Y3: €2,400 (scaled Mixcloud + bandwidth + dedicated container resources)

### Tech notes

- Lives in `services/tahti-radio/` — a separate Liquidsoap container
- Uses `input.http` to pull HLS from the currently-elected source channel
- Re-encodes to Opus 256 for output to its own HLS publish
- Uses `output.url` to push RTMP to Mixcloud Live
- Has a placeholder loop file checked into the repo at
  `services/tahti-radio/placeholder.flac` — public-domain instrumental + voice
  tag. Played when zero channels are live.
- Orchestrator service has a new "TahtiRadioPicker" routine that runs every
  60 seconds, evaluates the candidate list, and rewrites the meta-stream's
  Liquidsoap source URL if a switch is warranted.

### Listener experience

`radio.tahti.fi` is a minimal page:
- Always-playing HLS player
- "Now broadcasting: [artist name]" with link to their channel
- "Up next" doesn't exist (we don't know)
- Chat reflects whichever channel is being relayed (joining radio chat
  redirects to the source channel's chat)

Or listeners can subscribe to Tahti Radio on Mixcloud and tune in there.

## Venue calendar API

A lightweight system for venues to publish what's broadcasting at their
location, so artists can promote venue-tied broadcasts and listeners can
discover scene activity by physical location.

### What it is

- Venue creates a free venue profile at `tahti.fi/v/<venue-slug>`
- Venue defines: name, location, address, capacity, photos, externals
- Venue publishes broadcasts: "DJ Long Doe broadcasting from us, Friday 22:00"
- Each venue has an iCalendar feed: `tahti.fi/v/<venue-slug>/calendar.ics`
- Artists can subscribe to venue feeds; venue subscriptions show up on their
  dashboard as "upcoming gigs"
- Listeners can subscribe to venue feeds in their calendar app

### What it isn't

- Not a booking marketplace. Venues don't post "open slots" for artists to
  apply to. That's Resident Advisor territory.
- Not a ticketing system. Tickets are sold elsewhere (Eventbrite, Dice, etc.)
  — the venue links out from their profile.
- Not a venue review system. No ratings, no comments.

### Venue accounts

A new account type: `VENUE`. Separate from `ARTIST`. Venues can:
- Create and edit their profile
- Publish, edit, delete broadcasts on their calendar
- Subscribe to artists they work with (notifications when those artists go live)
- Optionally embed the artist's channel player on the venue profile while
  they're broadcasting on-premises

Venues do not:
- Have channels of their own to broadcast (broadcasting is the artist's act)
- Receive grants (they're not members in the bylaws sense)
- Pay subscriptions (free service for venues)

### Broadcast records

A `VenueBroadcast` is a planned future or past event:

```prisma
model Venue {
  id           String   @id @default(cuid())
  slug         String   @unique
  name         String
  address      String
  city         String
  countryCode  String
  latitude     Float?
  longitude    Float?
  capacity     Int?
  description  String?  // Markdown
  externalLinks Json?
  photos       String[]
  verifiedAt   DateTime?  // manual verification by org
  createdBy    String     // user ID of venue rep
  createdAt    DateTime   @default(now())

  broadcasts   VenueBroadcast[]

  @@schema("venue")
}

model VenueBroadcast {
  id          String   @id @default(cuid())
  venueId     String
  venue       Venue    @relation(fields: [venueId], references: [id])
  artistUserId String   // the artist broadcasting
  startAt     DateTime
  endAt       DateTime?
  description String?
  channelId   String?  // populated when the broadcast actually happens
  state       VenueBroadcastState @default(SCHEDULED)
  createdAt   DateTime @default(now())

  @@index([venueId, startAt])
  @@index([artistUserId, startAt])
  @@schema("venue")
}

enum VenueBroadcastState { SCHEDULED LIVE COMPLETED CANCELED }
```

### Calendar feed

Standard iCalendar (RFC 5545):

```
GET /v/<venue-slug>/calendar.ics

BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Tahti ry//Venue Calendar//EN
NAME:[Venue Name] —  Tahti broadcasts
BEGIN:VEVENT
UID:venue-broadcast-<id>@tahti.fi
DTSTART:20260620T220000Z
DTEND:20260621T010000Z
SUMMARY:DJ Long Doe — live from [Venue Name]
DESCRIPTION:Listen live at https://long-doe.tahti.fi
LOCATION:[venue address]
URL:https://tahti.fi/v/<venue-slug>
END:VEVENT
END:VCALENDAR
```

JSON API also available: `GET /v1/venues/<slug>/broadcasts?from=&to=`

### Discovery

- `tahti.fi/venues` lists all verified venues (paginated, geo-filterable)
- `tahti.fi/v/<slug>` shows venue profile + upcoming broadcasts + past broadcasts
- Artist profile shows "Past gigs" pulled from venue records they were tagged in

### Verification

Venues self-register but are flagged `verifiedAt = NULL` until a board-approved
verifier (initially the director, later expandable) confirms:
- Real venue (web search, social presence)
- Real contact person (email confirmation)
- Not a duplicate of an existing entry

Verification takes ~3 business days. Unverified venues can still be created
and used by artists (the artist might be the only person who knows the venue
exists), but they don't show up in public directories.

### Cost

Modeled in financials at:
- Y1: €0 (just dev time, no external services)
- Y2: €200 (manual verification overhead as venue count grows)
- Y3: €600 (verification + occasional spam-handling)

### Tech notes

- Lives in `apps/api` (no new service)
- Adds `VENUE` to the user role enum
- New routes:
  - `GET/POST /v1/venues`
  - `GET/PATCH/DELETE /v1/venues/<id>`
  - `GET/POST /v1/venues/<id>/broadcasts`
  - `GET /v/<slug>/calendar.ics`  (public)
  - `GET /venues`  (Next.js page)
  - `GET /v/<slug>`  (Next.js page)
