// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Seeds a handful of varied artists with real-looking avatar/cover/artwork
 * images (Lorem Picsum, deterministic per-seed URLs) plus tracks, releases
 * and collections — for local visual QA / screenshots, not CI assertions.
 * Idempotent: safe to re-run, wipes and recreates its own fixture users only.
 *
 * Run (stack): docker compose -f infra/docker-compose.stack.yml run --rm --no-deps \
 *   -e DATABASE_URL=postgresql://tahti:tahti_dev@postgres:5432/tahti -w /app \
 *   api tsx apps/api/scripts/seed-visual-mock-data.ts
 */

import { prisma } from '@tahti/db'
import { hashPassword } from '../src/lib/password.js'
import { s3 } from '../src/lib/minio.js'
import { config } from '../src/config.js'
import { PutObjectCommand } from '@aws-sdk/client-s3'

const PASS = 'visual-mock-pass'

function makeSilentWav(durationSec = 5, sampleRate = 8000): Buffer {
  const numSamples = sampleRate * durationSec
  const dataSize = numSamples * 2
  const buf = Buffer.alloc(44 + dataSize)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataSize, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(sampleRate * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(dataSize, 40)
  return buf
}

async function uploadFixtureAudio(key: string, contentType: string): Promise<void> {
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: config.minio.bucket,
        Key: key,
        Body: makeSilentWav(),
        ContentType: contentType,
      }),
    )
  } catch (err) {
    console.warn(`fixture audio upload skipped for ${key}: ${String(err)}`)
  }
}

const avatarUrl = (seed: string) => `https://picsum.photos/seed/${seed}-avatar/400/400`
const coverUrl = (seed: string) => `https://picsum.photos/seed/${seed}/900/900`

interface TrackSpec {
  title: string
  genre: string
  durationSec: number
}

interface ArtistSpec {
  username: string
  displayName: string
  bio: string
  countryCode: string
  genre: string
  tracks: TrackSpec[]
  release: { title: string; type: 'EP' | 'ALBUM' | 'SINGLE'; tracks: string[] }
  collection: { name: string; type: 'MIX_SERIES' | 'ALBUM' | 'CUSTOM' }
}

const ARTISTS: ArtistSpec[] = [
  {
    username: 'mock-nova-drift',
    displayName: 'Nova Drift',
    bio: 'Melodic techno & ambient textures, broadcasting from Helsinki. Member-owned radio for independent sound.',
    countryCode: 'FI',
    genre: 'Melodic Techno',
    tracks: [
      { title: 'Polar Bloom', genre: 'Melodic Techno', durationSec: 342 },
      { title: 'Glacier Pulse', genre: 'Ambient', durationSec: 480 },
      { title: 'Midsummer Static', genre: 'Melodic Techno', durationSec: 298 },
      { title: 'Aurora Chant', genre: 'Ambient', durationSec: 410 },
    ],
    release: { title: 'Glacier Pulse EP', type: 'EP', tracks: ['Polar Bloom', 'Glacier Pulse'] },
    collection: { name: 'Late Night Sessions', type: 'MIX_SERIES' },
  },
  {
    username: 'mock-echo-harbor',
    displayName: 'Echo Harbor',
    bio: 'Dub-influenced live sets recorded on the Turku waterfront. Bass-heavy, tide-timed broadcasts.',
    countryCode: 'FI',
    genre: 'Dub',
    tracks: [
      { title: 'Low Tide Dub', genre: 'Dub', durationSec: 355 },
      { title: 'Skerry Echo', genre: 'Dub', durationSec: 412 },
      { title: 'Salt Chamber', genre: 'Dub', durationSec: 288 },
    ],
    release: { title: 'Salt Chamber', type: 'SINGLE', tracks: ['Salt Chamber'] },
    collection: { name: 'Harbor Dub Archive', type: 'ALBUM' },
  },
  {
    username: 'mock-tuuli-ren',
    displayName: 'Tuuli Ren',
    bio: 'Field-recording collage and modular synthesis. Recorded live across the archipelago.',
    countryCode: 'FI',
    genre: 'Experimental',
    tracks: [
      { title: 'Windward', genre: 'Experimental', durationSec: 501 },
      { title: 'Granite Choir', genre: 'Experimental', durationSec: 322 },
      { title: 'Lichen Static', genre: 'Drone', durationSec: 610 },
      { title: 'Skerry Loop', genre: 'Drone', durationSec: 275 },
      { title: 'Cold Frame', genre: 'Experimental', durationSec: 340 },
    ],
    release: {
      title: 'Granite Choir',
      type: 'ALBUM',
      tracks: ['Windward', 'Granite Choir', 'Lichen Static'],
    },
    collection: { name: 'Field Recordings', type: 'CUSTOM' },
  },
  {
    username: 'mock-dj-kaski',
    displayName: 'DJ Kaski',
    bio: 'Breakbeat and jungle selector. Weekly live sets, always vinyl-first.',
    countryCode: 'FI',
    genre: 'Breakbeat',
    tracks: [
      { title: 'Rapids Break', genre: 'Breakbeat', durationSec: 265 },
      { title: 'Jungle Ferry', genre: 'Jungle', durationSec: 301 },
      { title: 'Concrete Rush', genre: 'Breakbeat', durationSec: 244 },
    ],
    release: { title: 'Rapids Break', type: 'SINGLE', tracks: ['Rapids Break'] },
    collection: { name: 'Vinyl-First Sets', type: 'MIX_SERIES' },
  },
  {
    username: 'mock-hiljainen',
    displayName: 'Hiljainen',
    bio: 'Piano-led neoclassical, recorded in an old sauna converted into a studio.',
    countryCode: 'FI',
    genre: 'Neoclassical',
    tracks: [
      { title: 'Löyly', genre: 'Neoclassical', durationSec: 220 },
      { title: 'Ember Room', genre: 'Neoclassical', durationSec: 198 },
      { title: 'Birchwood', genre: 'Neoclassical', durationSec: 254 },
      { title: 'Quiet Coal', genre: 'Neoclassical', durationSec: 233 },
    ],
    release: {
      title: 'Sauna Sessions',
      type: 'EP',
      tracks: ['Löyly', 'Ember Room', 'Birchwood'],
    },
    collection: { name: 'Sauna Sessions Archive', type: 'ALBUM' },
  },
  {
    username: 'mock-rautatie',
    displayName: 'Rautatie Collective',
    bio: 'Four-piece live band improvising over train-yard field recordings. Recorded live to tape.',
    countryCode: 'FI',
    genre: 'Post-rock',
    tracks: [
      { title: 'Signal Box', genre: 'Post-rock', durationSec: 388 },
      { title: 'Departures', genre: 'Post-rock', durationSec: 452 },
      { title: 'Night Freight', genre: 'Post-rock', durationSec: 401 },
    ],
    release: {
      title: 'Departures',
      type: 'ALBUM',
      tracks: ['Signal Box', 'Departures', 'Night Freight'],
    },
    collection: { name: 'Live to Tape', type: 'MIX_SERIES' },
  },
]

async function main() {
  const passwordHash = await hashPassword(PASS)

  for (const spec of ARTISTS) {
    const existing = await prisma.user.findUnique({
      where: { username: spec.username },
      select: { id: true, channel: { select: { id: true } } },
    })
    if (existing) {
      if (existing.channel) {
        await prisma.archiveItem.deleteMany({ where: { channelId: existing.channel.id } })
      }
      await prisma.collection.deleteMany({ where: { userId: existing.id } })
      await prisma.release.deleteMany({ where: { userId: existing.id } })
      await prisma.user.delete({ where: { id: existing.id } })
    }

    const artist = await prisma.user.create({
      data: {
        email: `${spec.username}@mock.tahti.live`,
        passwordHash,
        username: spec.username,
        displayName: spec.displayName,
        bio: spec.bio,
        avatarUrl: avatarUrl(spec.username),
        countryCode: spec.countryCode,
        emailVerifiedAt: new Date(),
        tier: 'ARTIST',
        isMember: true,
        memberNumber: 90000 + ARTISTS.indexOf(spec),
        memberSince: new Date(),
        membership: { create: { status: 'ACTIVE', activatedAt: new Date() } },
        channel: {
          create: {
            slug: spec.username,
            liveSourceMount: `/live/${spec.username}`,
            liveSourcePass: 'mock-pass',
            liveSourcePassHash: await hashPassword('mock-pass'),
            rtmpStreamKey: `${spec.username}__mock`,
            rtmpStreamKeyHash: await hashPassword(`${spec.username}__mock`),
            state: 'OFFLINE',
            fallbackMode: 'ordered',
          },
        },
      },
      include: { channel: true },
    })

    const archiveItems: Record<string, { id: string }> = {}
    for (const [i, track] of spec.tracks.entries()) {
      const item = await prisma.archiveItem.create({
        data: {
          channelId: artist.channel!.id,
          title: track.title,
          genre: track.genre,
          bannerUrl: coverUrl(`${spec.username}-${i}`),
          rawKey: `raw/${spec.username}/${i}.wav`,
          mp3Key: `mp3/${spec.username}/${i}.mp3`,
          durationSec: track.durationSec,
          fileSizeBytes: BigInt(4_000_000 + i * 100_000),
          status: 'READY',
          isPublic: true,
        },
      })
      archiveItems[track.title] = item
      await Promise.all([
        uploadFixtureAudio(item.rawKey!, 'audio/wav'),
        uploadFixtureAudio(item.mp3Key!, 'audio/mpeg'),
      ])
    }

    await prisma.release.create({
      data: {
        userId: artist.id,
        title: spec.release.title,
        type: spec.release.type,
        artworkUrl: coverUrl(`${spec.username}-release`),
        releaseDate: new Date('2026-04-01'),
        description: `${spec.release.title} — mock release for visual QA.`,
        smartLinkSlug: `${spec.username}-${spec.release.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        state: 'PUBLISHED',
        publishedAt: new Date(),
        tracks: {
          create: spec.release.tracks.map((title, i) => ({
            position: i + 1,
            title,
            durationSec: archiveItems[title]?.id
              ? spec.tracks.find((t) => t.title === title)?.durationSec
              : undefined,
            archiveItemId: archiveItems[title]?.id,
          })),
        },
      },
    })

    await prisma.collection.create({
      data: {
        userId: artist.id,
        slug: `${spec.username}-${spec.collection.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: spec.collection.name,
        type: spec.collection.type,
        isPublic: true,
        isFeatured: true,
        description: `${spec.collection.name} — mock collection for visual QA.`,
        coverUrl: coverUrl(`${spec.username}-collection`),
        items: {
          create: spec.tracks.slice(0, 3).map((track, i) => ({
            archiveItemId: archiveItems[track.title].id,
            position: i + 1,
          })),
        },
      },
    })

    console.log(`seeded ${spec.displayName} (@${spec.username}) — ${spec.tracks.length} tracks`)
  }

  console.log(
    JSON.stringify({
      ok: true,
      artists: ARTISTS.length,
      password: PASS,
      profiles: ARTISTS.map((a) => `/u/${a.username}`),
    }),
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
