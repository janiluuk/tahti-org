// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import Link from 'next/link'

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
    <article style={{ maxWidth: 720, margin: '2rem auto', padding: '0 1.5rem', lineHeight: 1.6 }}>
      <p>
        <Link href="/dashboard">← Dashboard</Link>
      </p>
      <h1 style={{ marginTop: '1rem' }}>Multistream setup</h1>
      <p>
        Stream <strong>once</strong> from OBS to Tahti. In the dashboard <strong>Multistream</strong>{' '}
        section, add each other platform and paste its <strong>stream key</strong> (from that
        platform&apos;s site — not a Tahti login and not a Google/Twitch API key).
      </p>

      <h2>Quick steps</h2>
      <ol>
        <li>Get a stream key from the platform (see table below).</li>
        <li>
          Dashboard → <strong>Multistream</strong> → <strong>Add destination</strong>.
        </li>
        <li>Choose platform, label, paste key, save. Keep <strong>Active</strong> checked.</li>
        <li>Go live on Tahti (OBS → Tahti RTMP). Other sites receive the mirror while you are Live.</li>
      </ol>

      <h2>Where to copy keys</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
            <th style={{ padding: '0.5rem 0' }}>Platform</th>
            <th style={{ padding: '0.5rem 0' }}>Steps</th>
          </tr>
        </thead>
        <tbody>
          {PLATFORMS.map((p) => (
            <tr key={p.name} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '0.6rem 0.5rem 0.6rem 0', verticalAlign: 'top' }}>
                {p.url ? (
                  <a href={p.url} target="_blank" rel="noopener noreferrer">
                    {p.name}
                  </a>
                ) : (
                  p.name
                )}
              </td>
              <td style={{ padding: '0.6rem 0', color: '#444' }}>{p.steps}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Security</h2>
      <ul>
        <li>Never post stream keys in chat, screenshots, or social posts.</li>
        <li>If a key leaks, reset it on the platform and update Tahti.</li>
        <li>Your OBS → Tahti key is separate; that one stays in Stream settings only.</li>
      </ul>

      <p style={{ color: '#666', fontSize: '0.9rem' }}>
        Full guide in the repo: <code>docs/guides/multistream-simulcast.md</code>
      </p>
    </article>
  )
}
