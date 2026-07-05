// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Heading, Link, Text } from '@tahti/ui'

export default function BroadcastHelpPage() {
  return (
    <article className="brand-prose">
      <Text size="sm">
        <Link href="/dashboard">← Dashboard</Link>
      </Text>

      <Heading level={1}>Broadcast setup guides</Heading>
      <Text>
        Copy your personal credentials from the dashboard <strong>Go Live</strong> panel, then
        follow the steps for your tool. You stream <strong>once</strong> to Tahti; multistream
        mirrors to YouTube, Twitch, and other sites separately.
      </Text>

      <Heading level={2}>OBS Studio / Streamlabs (RTMP)</Heading>
      <ol>
        <li>
          Dashboard → <strong>Go Live</strong> → copy <strong>Server</strong> and{' '}
          <strong>Stream Key</strong> under OBS / Streamlabs.
        </li>
        <li>
          OBS → <strong>Settings</strong> → <strong>Stream</strong>: Service <strong>Custom</strong>
          , paste server and key.
        </li>
        <li>
          <strong>Settings → Output</strong>: Audio bitrate 128–192 kbps, AAC. Video optional (many
          DJs use a static cover image).
        </li>
        <li>
          <strong>Settings → Audio</strong>: Route your deck or system audio to the stream; disable
          monitoring on the same device if you hear echo.
        </li>
        <li>
          Click <strong>Start Streaming</strong>. Your channel page shows Live when ingest connects.
        </li>
      </ol>
      <Text size="sm" tone="muted">
        Need YouTube or Twitch too? See <Link href="/help/multistream">Multistream setup</Link> — do
        not point OBS at those keys directly.
      </Text>

      <Heading level={2}>Streaming from your phone</Heading>
      <Text>
        Same RTMP credentials as OBS above — any RTMP broadcasting app works.{' '}
        <strong>Larix Broadcaster</strong> (free, iOS/Android) is a solid default.
      </Text>
      <ol>
        <li>
          Dashboard → <strong>Go Live</strong> → copy <strong>Server</strong> and{' '}
          <strong>Stream Key</strong> under OBS / Streamlabs (same ones as desktop).
        </li>
        <li>
          Install Larix Broadcaster → add a connection → paste the server URL as{' '}
          <strong>URL</strong> and the stream key as <strong>Stream name</strong> (Larix splits them
          automatically if you paste the full <code>rtmp://.../key</code> into URL).
        </li>
        <li>Audio: AAC, 128–192 kbps. Turn off video if you only want an audio broadcast.</li>
        <li>
          Tap the connection to go live. Your channel page shows Live when ingest connects — same as
          OBS.
        </li>
      </ol>

      <Heading level={2}>Mixxx / Traktor / butt (Icecast)</Heading>
      <ol>
        <li>
          Dashboard → <strong>Go Live</strong> → copy <strong>Server</strong>,{' '}
          <strong>Mount</strong>, and <strong>Password</strong> under Mixxx / Traktor / butt.
        </li>
        <li>
          <strong>Mixxx:</strong> Preferences → Live Broadcasting → Type <strong>Icecast 2</strong>,
          host/port from the server URL, mount and password as shown.
        </li>
        <li>
          <strong>Traktor:</strong> Preferences → Broadcasting → Icecast, same fields (split host
          and port from the server URL if needed).
        </li>
        <li>
          <strong>butt:</strong> Server = host, Port = from URL, Mountpoint = mount, Password =
          Icecast password, Audio = your input device.
        </li>
        <li>
          Start broadcasting in the DJ app. Icecast credentials rotate independently from RTMP.
        </li>
      </ol>

      <Heading level={2}>Recommended audio</Heading>
      <ul>
        <li>Codec: AAC or MP3</li>
        <li>Bitrate: 128 kbps (talk/low bandwidth) or 192 kbps (club sets)</li>
        <li>Sample rate: 44.1 kHz or 48 kHz — match your audio interface</li>
        <li>Stereo for DJ sets; mono only if bandwidth is very limited</li>
      </ul>

      <Heading level={2}>Troubleshooting</Heading>
      <ul>
        <li>
          <strong>Connection refused:</strong> check firewall/VPN; confirm server URL matches the
          dashboard exactly.
        </li>
        <li>
          <strong>401 / auth failed:</strong> rotate the key in Go Live and update the broadcaster.
        </li>
        <li>
          <strong>Live but silent:</strong> verify the correct audio bus is routed to the stream in
          OBS or Mixxx.
        </li>
        <li>
          <strong>Key leaked:</strong> rotate immediately in the dashboard. When offline, old keys
          stop working at once; while live, the previous key stays valid for 24 hours — update OBS
          or your DJ app to the new credential as soon as you can.
        </li>
      </ul>

      <Text size="sm" tone="muted">
        Weekly hour cap and MP3 vs FLAC: <Link href="/help/tier-limits">tier limits guide</Link>
      </Text>

      <Text size="sm" tone="muted">
        Operator reference: <code>docs/obs-and-broadcasting-guides.md</code>
      </Text>
    </article>
  )
}
