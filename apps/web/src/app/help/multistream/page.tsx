// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Heading, Link, Text } from '@tahti/ui'

const PLATFORMS: { name: string; steps: string; url?: string }[] = [
  {
    name: 'YouTube Live',
    steps: 'YouTube Studio → Create → Go live → Stream → copy stream key.',
    url: 'https://studio.youtube.com/',
  },
  {
    name: 'Twitch',
    steps: 'Creator Dashboard → Settings → Stream → Primary Stream key.',
    url: 'https://dashboard.twitch.tv/settings/stream',
  },
  {
    name: 'Facebook Live',
    steps: 'Live Producer / Page → Streaming software → copy stream key.',
    url: 'https://live.fb.com/',
  },
  {
    name: 'Kick',
    steps: 'Kick Creator Dashboard → stream settings → stream key.',
    url: 'https://kick.com/dashboard',
  },
  {
    name: 'TikTok Live (RTMP)',
    steps: 'TikTok Live Studio → RTMP → stream key (if your account has RTMP).',
  },
  {
    name: 'Mixcloud Live',
    steps: 'Mixcloud Live settings → stream key.',
    url: 'https://www.mixcloud.com/',
  },
  {
    name: 'Instagram Live (RTMP)',
    steps: 'Professional live tools → RTMP key when Instagram offers it.',
  },
  {
    name: 'Custom',
    steps: 'Paste RTMP URL + stream key from any other service (Restream ingest, etc.).',
  },
]

export default function MultistreamHelpPage() {
  return (
    <article className="brand-prose">
      <Text size="sm">
        <Link href="/dashboard">← Dashboard</Link>
      </Text>

      <Heading level={1}>Multistream setup</Heading>
      <Text>
        Stream <strong>once</strong> from OBS to Tahti. In the dashboard{' '}
        <strong>Multistream</strong> section, add each other platform and paste its{' '}
        <strong>stream key</strong> (from that platform&apos;s site — not a Tahti login and not a
        Google/Twitch API key).
      </Text>

      <Heading level={2}>Quick steps</Heading>
      <ol>
        <li>Get a stream key from the platform (see table below).</li>
        <li>
          Dashboard → <strong>Multistream</strong> → <strong>Add destination</strong>.
        </li>
        <li>
          Choose platform, label, paste key, save. Keep <strong>Active</strong> checked.
        </li>
        <li>
          Go live on Tahti (OBS → Tahti RTMP). Other sites receive the mirror while you are Live.
        </li>
      </ol>

      <Heading level={2}>Where to copy keys</Heading>
      <div className="brand-table-wrap">
        <table className="brand-table">
          <thead>
            <tr>
              <th>Platform</th>
              <th>Steps</th>
            </tr>
          </thead>
          <tbody>
            {PLATFORMS.map((p) => (
              <tr key={p.name}>
                <td>
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noopener noreferrer">
                      {p.name}
                    </a>
                  ) : (
                    p.name
                  )}
                </td>
                <td>{p.steps}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Heading level={2}>Security</Heading>
      <ul>
        <li>Never post stream keys in chat, screenshots, or social posts.</li>
        <li>If a key leaks, reset it on the platform and update Tahti.</li>
        <li>Your OBS → Tahti key is separate; that one stays in Stream settings only.</li>
      </ul>

      <Text size="sm" tone="muted">
        Full guide in the repo: <code>docs/guides/multistream-simulcast.md</code>
      </Text>
    </article>
  )
}
