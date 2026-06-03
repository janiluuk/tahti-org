# Tahti ry — broadcasting tool guides

Every member gets one-click access to a personalized setup guide for their
preferred broadcasting tool. The guide includes their current credentials,
recommended settings, and a "test connection" button.

## Multistream to Twitch, YouTube, and other sites

Artists do **not** wire OBS to each platform separately. They stream once to Tahti,
then add **Multistream** destinations in the dashboard (stream key per platform).

Step-by-step for every supported service: **[guides/multistream-simulcast.md](guides/multistream-simulcast.md)**.
In the web app: `/help/multistream`.

---

## Coverage

Each artist's `/me/broadcast/guides/:tool` endpoint generates a personalized
guide for:

- **OBS Studio** — most popular, video+audio capable
- **Streamlabs Desktop** — OBS-based, similar setup
- **vMix** — Windows pro tool
- **Mixxx** — open-source DJ software
- **Traktor Pro** — Native Instruments DJ software
- **Rekordbox** — Pioneer DJ software
- **VirtualDJ** — DJ software with streaming built-in
- **butt** (Broadcast Using This Tool) — minimal Icecast/Shoutcast streamer
- **BUTT** alternative spelling, same tool
- **SAM Cast** — Windows Icecast streamer
- **Liquidsoap** — for power users running their own scripts
- **FFmpeg** — for pure command-line broadcasters
- **Browser** — our built-in WebRTC-based Go Live client

## What each guide includes

1. **Per-artist credentials**, pre-filled and copyable:
   - For Icecast tools: server URL, mount point, source password, content format
   - For RTMP tools: server URL, stream key
2. **Recommended audio settings** (codec, bitrate, sample rate, channels)
3. **Recommended video settings** (for tools that need a "video" track —
   typically just a static cover image)
4. **Step-by-step setup** with screenshots
5. **Common gotchas** (audio routing, sample-rate mismatches, etc.)
6. **"Test connection" button** that performs a 10-second probe and reports back

## Detailed: OBS Studio guide content

This is the model the agent should follow for all tools. Headlines, screenshots,
exact field values, and gotchas.

---

### Broadcasting to your  Tahti channel from OBS Studio

You'll be live in about 5 minutes.

**Step 1 — open OBS Studio settings**

In OBS, click **Settings** in the bottom-right of the main window. The settings
dialog opens.

**Step 2 — configure the streaming server**

In the settings dialog, click **Stream** in the left sidebar.

- **Service:** select *Custom...*
- **Server:** `rtmp://rtmp.tahti.live/live` *(copy)*
- **Stream Key:** `<channel-id>__<rotating-secret>` *(copy — keep this private)*

Click *Apply*.

**Step 3 — configure the audio**

Click **Audio** in the left sidebar.

- **Sample Rate:** 44.1 kHz
- **Channels:** Stereo

Click *Apply*.

**Step 4 — configure the output**

Click **Output** in the left sidebar.

- **Output Mode:** Advanced
- Click the **Streaming** tab
- **Audio Encoder:** FFmpeg AAC
- **Audio Bitrate:** 128 kbps (or 192 if your connection is solid)
- **Video Encoder:** x264
- **Rate Control:** CBR
- **Bitrate:** 2500 kbps
- **Keyframe Interval:** 2 seconds
- **Preset:** veryfast
- **Profile:** main
- **Tune:** zerolatency

Click *Apply*, then *OK* to close settings.

**Step 5 — add your audio source**

Back in the main OBS window, in the *Sources* panel:

- Click the **+** button
- Choose **Audio Input Capture**
- Name it ("Mic" or "DJ Mixer" or whatever fits)
- Click *OK*
- In the dropdown, pick the audio input you're broadcasting from (your audio
  interface, virtual cable, etc.)
- Click *OK*

If you're routing audio from a DJ software running on the same machine, you'll
typically use a virtual audio device (BlackHole on macOS, VB-Audio Cable on
Windows) to pipe DJ software output into OBS.

**Step 6 — add your cover art**

In the *Sources* panel:

- Click **+**
- Choose **Image**
- Name it ("Cover")
- Browse to your channel cover art (we recommend 1920×1080 PNG or JPG)
- Click *OK*
- Resize and position the image to fill the canvas

**Step 7 — go live**

Click **Start Streaming** in the bottom-right of OBS.

After about 5 seconds, your channel at `<your-slug>.tahti.live` will be live.
Your dashboard will show *LIVE* status. Listeners can tune in.

**Step 8 — when you're done**

Click **Stop Streaming** in OBS.

Within about 10 seconds, your channel transitions back to playing from your
archive. If this was a session worth keeping, the recording will appear in your
archive within 5 minutes — you can title and describe it from your dashboard.

---

### Common gotchas

**"My audio is silent on the stream."**
The most common cause is the audio source not routed to OBS. Check that the
audio input in OBS is the correct device, and that the meter is moving when you
make noise.

**"My stream is laggy or stuttering."**
Drop the video bitrate from 2500 to 1500 or 1000 kbps. Audio-only listeners
won't notice; your connection will be happier.

**"The connection drops mid-stream."**
Two likely causes: unstable internet (try wired Ethernet), or stream key
rotation (if you regenerated keys mid-stream, OBS still uses the old one —
update in *Settings → Stream*).

**"OBS says authentication failed."**
The stream key is wrong. In your dashboard, click *Show RTMP credentials* to
reveal the current key, and copy it again — there are no spaces or quotes.

**"I want to broadcast from a different machine each time."**
Save your OBS settings as a profile (*Profile → Export*). Save your scene
collection too. Carry both as a USB stick or sync via cloud, and on each
machine, import them.

---

## Detailed: Mixxx guide content

Mixxx ships with Icecast/Shoutcast streaming built in. Mixxx is also free and
open-source, like us — strong aesthetic fit.

### Broadcasting to your  Tahti channel from Mixxx

**Step 1 — open Mixxx preferences**

In Mixxx, *Options → Preferences* (or *Mixxx → Preferences* on macOS).

**Step 2 — enable Live Broadcasting**

In the left sidebar, click **Live Broadcasting**.

- **Server connection 1:**
  - **Type:** Icecast 2
  - **Host:** `icecast.tahti.live`
  - **Mount:** `/live/<channel-slug>` *(copy)*
  - **Port:** `8000`
  - **Login:** `source`
  - **Password:** `<your-source-password>` *(copy — keep this private)*

**Step 3 — configure the audio**

In the same dialog:

- **Stream type:** Ogg Vorbis (preferred) or MP3
- **Stream bitrate:** 256 kbps (or 192 if connection is iffy)
- **Stream channels:** Stereo

**Step 4 — set metadata**

- **Stream name:** the name of your live show
- **Stream description:** what you're playing
- **Stream genre:** as appropriate
- **Public stream:** unchecked (Tahti's directory is curated, not auto-listed)

**Step 5 — enable broadcasting**

Click *Apply*, then *OK*.

In the main Mixxx window, click the **Broadcast** button (top toolbar) to
start streaming. Mixxx connects to  Tahti and your channel goes live.

**Step 6 — when you're done**

Click *Broadcast* again to stop. Channel returns to archive playback within
about 10 seconds.

---

## Detailed: Traktor Pro guide content

Traktor has built-in broadcasting via Icecast.

### Broadcasting to your  Tahti channel from Traktor Pro

**Step 1 — open Traktor preferences**

In Traktor, click the gear icon in the top-right.

**Step 2 — go to the Broadcasting section**

In the preferences sidebar, click **Broadcasting**.

**Step 3 — configure server**

- **Server Type:** Icecast 2
- **Address:** `icecast.tahti.live`
- **Port:** `8000`
- **Mount Path:** `/live/<channel-slug>` *(copy)*
- **Password:** `<your-source-password>` *(copy)*
- **Format:** Ogg Vorbis 256 kbps *(or MP3 192 kbps)*

Apply.

**Step 4 — start broadcasting**

Traktor doesn't have a visible *Start broadcast* button by default. The
broadcast is controlled via the Audio Setup section:

- *Audio Setup → Output Routing*
- Ensure *Output Master* is also being sent to the broadcast bus
- *Live Output* should now be active

You're live. To stop, end the broadcasting from Traktor's preferences pane.

---

## Detailed: butt / BUTT guide content

butt (Broadcast Using This Tool) is a minimal Icecast streamer — perfect for
artists who don't want a DAW or DJ software running, e.g. for talk shows or
ambient streams.

### Broadcasting to your  Tahti channel from butt

**Step 1 — install butt**

Download from [danielnoethen.de/butt](https://danielnoethen.de/butt/). Available
for macOS, Windows, Linux.

**Step 2 — configure server**

In butt, click **Settings**.

- **Server settings:**
  - **Type:** Icecast
  - **Address:** `icecast.tahti.live`
  - **Port:** `8000`
  - **Password:** `<your-source-password>` *(copy)*
  - **Icecast mountpoint:** `/live/<channel-slug>` *(copy)*

**Step 3 — configure audio**

- **Codec:** Ogg/Vorbis (or MP3)
- **Bitrate:** 256 kbps
- **Sample rate:** 44100
- **Channels:** 2 (stereo)
- **Audio Device:** your input (mic, audio interface, virtual cable)

Apply.

**Step 4 — start broadcasting**

In butt's main window, click the **PLAY** button. The status indicator turns
green. You're live.

**Step 5 — when you're done**

Click the **STOP** button. Channel returns to archive.

---

## Detailed: browser-based broadcaster

For artists who want to broadcast with zero installation — useful for
talk-show-style channels or quick mobile broadcasts.

### Broadcasting from your browser

**Step 1 — sign in to your dashboard**

Go to your  Tahti dashboard and click **Go Live (Browser)** in the channel panel.

**Step 2 — grant microphone permission**

The browser will ask permission to access your microphone (or audio input
device). Accept.

**Step 3 — choose your input**

Select your microphone or audio interface from the dropdown. Speak/play a few
seconds to verify the level meter moves.

**Step 4 — set show title (optional)**

Type a title for this broadcast. This will be the title of the auto-archive
when you're done.

**Step 5 — click "Go Live"**

Within 3 seconds, your channel is live. You can talk, play music through your
audio input, or use any audio routing your OS supports.

**Step 6 — when you're done**

Click **End Broadcast**. The browser cleanly disconnects. Channel returns to
archive within 10 seconds, and your recording appears in your dashboard within
5 minutes.

### Limitations of the browser broadcaster

- Audio-only (no video upload)
- Quality capped at 192 kbps Opus (browser limitation)
- Requires Chrome, Firefox, or Safari ≥ 16
- WebRTC stability depends on listener-to-server network quality

For longer, higher-quality broadcasts, use OBS or one of the dedicated tools.

---

## Common to all tools — testing your connection

Every personalized guide ends with a **Test connection** button. Clicking it:

1. Generates a short test stream from our side (10 seconds of silent audio with
   a marker)
2. Attempts to push it through your channel's ingress
3. Reports back: *connected successfully, latency X ms, format Y*
4. Logs the test in your dashboard for support reference

This is the friendliest way to verify a new setup before going live for real.

---

## What the guide rendering does technically

When the agent serves `GET /v1/me/broadcast/guides/obs`, it:

1. Loads the OBS guide template from a `.md.hbs` file
2. Fills in the artist's current `rtmpStreamKey`, `liveSourcePass`, channel slug
3. Renders to Markdown
4. The frontend renders the Markdown with inline copy-to-clipboard buttons next
   to each `<code>` element
5. Screenshots are linked from a CDN bucket of stable, version-controlled
   tutorial images

Tool versions are tracked. When a new major OBS version ships with UI changes,
the guide template is updated and the version metadata changes — older
screenshots are kept available for users on old OBS versions.
