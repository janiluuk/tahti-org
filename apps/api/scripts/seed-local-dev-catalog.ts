// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Rich local-dev catalog: artists, tracks, EPs/albums, collections, live-show
 * series, scheduled episodes, and Tahti Radio calendar bookings — each with
 * distinct artwork stored in MinIO (genre-motif SVG covers + photographic
 * avatars/slideshow frames). Replaces the thin Picsum visual-mock seed.
 *
 * Idempotent: wipes and recreates its own fixture users only
 * (`@local.tahti.live` plus leftover `@mock.tahti.live` / `mock-*` usernames).
 *
 * Password for every catalog artist: tahti-local-dev
 *
 * Run (stack):
 *   docker compose -f infra/docker-compose.stack.yml exec api \
 *     tsx apps/api/scripts/seed-local-dev-catalog.ts
 */

import { randomBytes } from 'node:crypto'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { prisma } from '@tahti/db'
import { BRAND_ACCENT_PRESETS, TAHTI_RADIO_SLUG, type VisualPreset } from '@tahti/shared'
import { hashPassword } from '../src/lib/password.js'
import {
  generateAlbumArtSvg,
  generateAvatarSvg,
  generateChannelBannerSvg,
  type AlbumArtColors,
  type AlbumArtGenre,
} from '../src/lib/generate-cover-art.js'
import { s3, putObjectText, putObjectBuffer } from '../src/lib/minio.js'
import { config } from '../src/config.js'
import { publicMediaUrl } from '../src/lib/public-media-url.js'

const PASS = 'tahti-local-dev'
const DEFAULT_BG = '#0A0E1C'
const EMAIL_DOMAIN = 'local.tahti.live'
const LEGACY_EMAIL_DOMAIN = 'mock.tahti.live'

type ShowType = 'LIVE_SET' | 'TALK'
type ReleaseType = 'SINGLE' | 'EP' | 'ALBUM'
type CollectionType = 'MIX_SERIES' | 'ALBUM' | 'CUSTOM'
type ArchiveContentType = 'TRACK' | 'LIVE' | 'DJ_SET' | 'SHOW'

type TrackSpec = {
  title: string
  genre: string
  durationSec: number
  contentType?: ArchiveContentType
}

type ReleaseSpec = {
  title: string
  type: ReleaseType
  tracks: string[]
  description: string
}

type ShowSpec = {
  name: string
  tagline: string
  showType: ShowType
  scheduleNote: string
  episodes: Array<{
    title: string
    dayOffset: number
    startHourUtc: number
    durationHours: number
    venue?: string
    location?: string
  }>
}

type ArtistSpec = {
  username: string
  displayName: string
  bio: string
  fullBio: string
  countryCode: string
  genre: AlbumArtGenre
  visualPreset: VisualPreset
  brandAccentId: string
  tracks: TrackSpec[]
  releases: ReleaseSpec[]
  collection: { name: string; type: CollectionType }
  show: ShowSpec
  radioSlot: {
    dayOffset: number
    startHourUtc: number
    durationHours: number
    note: string
    showType: ShowType
  }
}

const ARTISTS: ArtistSpec[] = [
  {
    username: 'nova-drift',
    displayName: 'Nova Drift',
    bio: 'Melodic techno and ambient textures from Helsinki. Late-night broadcasts, long blends.',
    fullBio:
      'Nova Drift records in a converted Kallio loft. Sets lean on analog delay and field recordings from Suomenlinna ferries. Member of Tahti since the first winter roster.',
    countryCode: 'FI',
    genre: 'Electronic',
    visualPreset: 'AURORA',
    brandAccentId: 'aurora',
    tracks: [
      { title: 'Polar Bloom', genre: 'Melodic Techno', durationSec: 342 },
      { title: 'Glacier Pulse', genre: 'Ambient', durationSec: 480 },
      { title: 'Midsummer Static', genre: 'Melodic Techno', durationSec: 298 },
      { title: 'Aurora Chant', genre: 'Ambient', durationSec: 410 },
      { title: 'Harbour Delay', genre: 'Melodic Techno', durationSec: 376 },
      { title: 'Icebreakers', genre: 'Ambient', durationSec: 512 },
      {
        title: 'Kallio Live, March',
        genre: 'Melodic Techno',
        durationSec: 3180,
        contentType: 'LIVE',
      },
    ],
    releases: [
      {
        title: 'Glacier Pulse',
        type: 'EP',
        tracks: ['Polar Bloom', 'Glacier Pulse', 'Midsummer Static'],
        description: 'Three winter cuts recorded between ferry horns.',
      },
      {
        title: 'Icebreakers',
        type: 'ALBUM',
        tracks: ['Aurora Chant', 'Harbour Delay', 'Icebreakers'],
        description: 'A full-length for the long dark. Piano buried in frost.',
      },
      {
        title: 'Polar Bloom',
        type: 'SINGLE',
        tracks: ['Polar Bloom'],
        description: 'Lead single from Glacier Pulse.',
      },
    ],
    collection: { name: 'Late Night Sessions', type: 'MIX_SERIES' },
    show: {
      name: 'Drift After Hours',
      tagline: 'Two-hour live blend, no talking',
      showType: 'LIVE_SET',
      scheduleNote: 'Thursdays 22:00 EET',
      episodes: [
        {
          title: 'Drift After Hours 14',
          dayOffset: -3,
          startHourUtc: 19,
          durationHours: 2,
          venue: 'Loft 4',
          location: 'Kallio, Helsinki',
        },
        {
          title: 'Drift After Hours 15',
          dayOffset: 1,
          startHourUtc: 19,
          durationHours: 2,
          venue: 'Loft 4',
          location: 'Kallio, Helsinki',
        },
        {
          title: 'Drift After Hours 16',
          dayOffset: 8,
          startHourUtc: 19,
          durationHours: 2,
          venue: 'Loft 4',
          location: 'Kallio, Helsinki',
        },
      ],
    },
    radioSlot: {
      dayOffset: 1,
      startHourUtc: 15,
      durationHours: 1.5,
      note: 'Live set: Baltic electronic selections',
      showType: 'LIVE_SET',
    },
  },
  {
    username: 'echo-harbor',
    displayName: 'Echo Harbor',
    bio: 'Dub-influenced live sets recorded on the Turku waterfront. Bass-heavy, tide-timed.',
    fullBio:
      'Echo Harbor runs a small PA on a pontoon near Forum Marinum. Spring sessions are all spring reverb and cargo-ship radar clicks.',
    countryCode: 'FI',
    genre: 'Downtempo',
    visualPreset: 'WATER_RIPPLE',
    brandAccentId: 'deep',
    tracks: [
      { title: 'Low Tide Dub', genre: 'Dub', durationSec: 355 },
      { title: 'Skerry Echo', genre: 'Dub', durationSec: 412 },
      { title: 'Salt Chamber', genre: 'Dub', durationSec: 288 },
      { title: 'Pontoon', genre: 'Downtempo', durationSec: 401 },
      { title: 'Foghorn Version', genre: 'Dub', durationSec: 367 },
      {
        title: 'Waterfront Dub Session',
        genre: 'Dub',
        durationSec: 2740,
        contentType: 'DJ_SET',
      },
    ],
    releases: [
      {
        title: 'Salt Chamber',
        type: 'SINGLE',
        tracks: ['Salt Chamber'],
        description: 'A short dub for the 3am ferry.',
      },
      {
        title: 'Tide Tables',
        type: 'EP',
        tracks: ['Low Tide Dub', 'Skerry Echo', 'Pontoon'],
        description: 'Four-on-the-floor left at the dock. Actually three tracks.',
      },
    ],
    collection: { name: 'Harbor Dub Archive', type: 'ALBUM' },
    show: {
      name: 'Harbor Watch',
      tagline: 'Live dub from the pontoon',
      showType: 'LIVE_SET',
      scheduleNote: 'Saturdays 18:00 EET',
      episodes: [
        {
          title: 'Harbor Watch — Spring Equinox',
          dayOffset: -10,
          startHourUtc: 15,
          durationHours: 1.5,
          venue: 'Pontoon PA',
          location: 'Turku waterfront',
        },
        {
          title: 'Harbor Watch — Incoming Weather',
          dayOffset: 2,
          startHourUtc: 15,
          durationHours: 1.5,
          venue: 'Pontoon PA',
          location: 'Turku waterfront',
        },
      ],
    },
    radioSlot: {
      dayOffset: 2,
      startHourUtc: 16,
      durationHours: 1,
      note: 'Live dub set from Turku',
      showType: 'LIVE_SET',
    },
  },
  {
    username: 'tuuli-ren',
    displayName: 'Tuuli Ren',
    bio: 'Field-recording collage and modular synthesis. Recorded live across the archipelago.',
    fullBio:
      'Tuuli travels with a stereo pair and a small Eurorack case. Winter pieces are almost all wind through granite; summer adds insects and boat engines.',
    countryCode: 'FI',
    genre: 'Experimental',
    visualPreset: 'PARTICLE_FIELD',
    brandAccentId: 'mint',
    tracks: [
      { title: 'Windward', genre: 'Experimental', durationSec: 501 },
      { title: 'Granite Choir', genre: 'Experimental', durationSec: 322 },
      { title: 'Lichen Static', genre: 'Drone', durationSec: 610 },
      { title: 'Skerry Loop', genre: 'Drone', durationSec: 275 },
      { title: 'Cold Frame', genre: 'Experimental', durationSec: 340 },
      { title: 'Outer Islets', genre: 'Ambient', durationSec: 444 },
    ],
    releases: [
      {
        title: 'Granite Choir',
        type: 'ALBUM',
        tracks: ['Windward', 'Granite Choir', 'Lichen Static', 'Skerry Loop'],
        description: 'A long-form collage of the outer islets.',
      },
      {
        title: 'Cold Frame',
        type: 'EP',
        tracks: ['Cold Frame', 'Outer Islets'],
        description: 'Two greenhouse pieces for late frost.',
      },
    ],
    collection: { name: 'Field Recordings', type: 'CUSTOM' },
    show: {
      name: 'Listening Walks',
      tagline: 'Talk + playback of the week’s recordings',
      showType: 'TALK',
      scheduleNote: 'Tuesdays 19:00 EET',
      episodes: [
        {
          title: 'Listening Walks — Ice Out',
          dayOffset: 0,
          startHourUtc: 16,
          durationHours: 0.75,
          location: 'Korpoström',
        },
        {
          title: 'Listening Walks — Bird Island',
          dayOffset: 7,
          startHourUtc: 16,
          durationHours: 0.75,
          location: 'Korpoström',
        },
      ],
    },
    radioSlot: {
      dayOffset: 3,
      startHourUtc: 14,
      durationHours: 0.75,
      note: 'Artist talk: inside the new album',
      showType: 'TALK',
    },
  },
  {
    username: 'dj-kaski',
    displayName: 'DJ Kaski',
    bio: 'Breakbeat and jungle selector. Weekly live sets, always vinyl-first.',
    fullBio:
      'Kaski learned on Tampere pirate FM and never left the 160bpm lane. The weekly show is all original 12-inches plus two unreleased dubplates.',
    countryCode: 'FI',
    genre: 'Electronic',
    visualPreset: 'REACTIVE_GRID',
    brandAccentId: 'coral',
    tracks: [
      { title: 'Rapids Break', genre: 'Breakbeat', durationSec: 265 },
      { title: 'Jungle Ferry', genre: 'Jungle', durationSec: 301 },
      { title: 'Concrete Rush', genre: 'Breakbeat', durationSec: 244 },
      { title: 'Tammerkoski Edit', genre: 'Jungle', durationSec: 278 },
      {
        title: 'Friday Vinyl Hour',
        genre: 'Breakbeat',
        durationSec: 3600,
        contentType: 'DJ_SET',
      },
    ],
    releases: [
      {
        title: 'Rapids Break',
        type: 'SINGLE',
        tracks: ['Rapids Break'],
        description: 'A 12-inch cut for the Friday show.',
      },
      {
        title: 'Ferry Plate',
        type: 'EP',
        tracks: ['Jungle Ferry', 'Concrete Rush', 'Tammerkoski Edit'],
        description: 'Three dubplates pressed for the weekly vinyl hour.',
      },
    ],
    collection: { name: 'Vinyl-First Sets', type: 'MIX_SERIES' },
    show: {
      name: 'Vinyl Hour',
      tagline: 'No CDJs, no talking over the breaks',
      showType: 'LIVE_SET',
      scheduleNote: 'Fridays 21:00 EET',
      episodes: [
        {
          title: 'Vinyl Hour 88',
          dayOffset: -2,
          startHourUtc: 18,
          durationHours: 1,
          venue: 'Kellari',
          location: 'Tampere',
        },
        {
          title: 'Vinyl Hour 89',
          dayOffset: 4,
          startHourUtc: 18,
          durationHours: 1,
          venue: 'Kellari',
          location: 'Tampere',
        },
      ],
    },
    radioSlot: {
      dayOffset: 4,
      startHourUtc: 18,
      durationHours: 1.5,
      note: 'Jungle and breakbeat vinyl hour',
      showType: 'LIVE_SET',
    },
  },
  {
    username: 'hiljainen',
    displayName: 'Hiljainen',
    bio: 'Piano-led neoclassical, recorded in an old sauna converted into a studio.',
    fullBio:
      'The sauna still smells like birch. Hiljainen records at night after the stove dies down, one or two takes, no click.',
    countryCode: 'FI',
    genre: 'Ambient',
    visualPreset: 'CLOUDSCAPE',
    brandAccentId: 'violet',
    tracks: [
      { title: 'Löyly', genre: 'Neoclassical', durationSec: 220 },
      { title: 'Ember Room', genre: 'Neoclassical', durationSec: 198 },
      { title: 'Birchwood', genre: 'Neoclassical', durationSec: 254 },
      { title: 'Quiet Coal', genre: 'Neoclassical', durationSec: 233 },
      { title: 'Afterheat', genre: 'Ambient', durationSec: 301 },
    ],
    releases: [
      {
        title: 'Sauna Sessions',
        type: 'EP',
        tracks: ['Löyly', 'Ember Room', 'Birchwood'],
        description: 'Three piano pieces recorded after the last löyly.',
      },
      {
        title: 'Quiet Coal',
        type: 'SINGLE',
        tracks: ['Quiet Coal'],
        description: 'A coda for the stove.',
      },
    ],
    collection: { name: 'Sauna Sessions Archive', type: 'ALBUM' },
    show: {
      name: 'Ember Recital',
      tagline: 'Solo piano, one room mic',
      showType: 'LIVE_SET',
      scheduleNote: 'Sundays 17:00 EET',
      episodes: [
        {
          title: 'Ember Recital — Late Light',
          dayOffset: 5,
          startHourUtc: 14,
          durationHours: 1,
          venue: 'Sauna studio',
          location: 'Jyväskylä',
        },
      ],
    },
    radioSlot: {
      dayOffset: 5,
      startHourUtc: 15,
      durationHours: 1,
      note: 'Sunday piano recital',
      showType: 'LIVE_SET',
    },
  },
  {
    username: 'rautatie',
    displayName: 'Rautatie Collective',
    bio: 'Four-piece live band improvising over train-yard field recordings. Recorded live to tape.',
    fullBio:
      'Guitar, drums, bass, and a tape op. They set up next to the Oulu freight yard and let the couplings write the tempo.',
    countryCode: 'FI',
    genre: 'Experimental',
    visualPreset: 'LINE_TANGLE',
    brandAccentId: 'rose',
    tracks: [
      { title: 'Signal Box', genre: 'Post-rock', durationSec: 388 },
      { title: 'Departures', genre: 'Post-rock', durationSec: 452 },
      { title: 'Night Freight', genre: 'Post-rock', durationSec: 401 },
      { title: 'Switching Yard', genre: 'Post-rock', durationSec: 367 },
      {
        title: 'Yard Tape, Side A',
        genre: 'Post-rock',
        durationSec: 2400,
        contentType: 'SHOW',
      },
    ],
    releases: [
      {
        title: 'Departures',
        type: 'ALBUM',
        tracks: ['Signal Box', 'Departures', 'Night Freight', 'Switching Yard'],
        description: 'The first full tape. No overdubs.',
      },
    ],
    collection: { name: 'Live to Tape', type: 'MIX_SERIES' },
    show: {
      name: 'Yard Session',
      tagline: 'Improvised set against the freight timetable',
      showType: 'LIVE_SET',
      scheduleNote: 'Monthly, first Saturday',
      episodes: [
        {
          title: 'Yard Session — September',
          dayOffset: 6,
          startHourUtc: 17,
          durationHours: 2,
          venue: 'Freight platform 3',
          location: 'Oulu',
        },
      ],
    },
    radioSlot: {
      dayOffset: 6,
      startHourUtc: 17,
      durationHours: 2,
      note: 'Album release live set',
      showType: 'LIVE_SET',
    },
  },
  {
    username: 'sahkovalo',
    displayName: 'Sähkövalo',
    bio: 'Tallinn synthwave and neon-noir scores. Chrome drums, frozen arpeggios.',
    fullBio:
      'Sähkövalo writes like a night bus through Lasnamäe. Hardware only: Juno, TR-8, and a broken delay that never got fixed on purpose.',
    countryCode: 'EE',
    genre: 'Synthwave',
    visualPreset: 'LENS_FLARES',
    brandAccentId: 'coral',
    tracks: [
      { title: 'Nightbus 18', genre: 'Synthwave', durationSec: 312 },
      { title: 'Chrome District', genre: 'Synthwave', durationSec: 286 },
      { title: 'Frozen Arp', genre: 'Synthwave', durationSec: 334 },
      { title: 'Overpass', genre: 'Electronic', durationSec: 298 },
      { title: 'Last Stop', genre: 'Synthwave', durationSec: 355 },
    ],
    releases: [
      {
        title: 'Nightbus 18',
        type: 'EP',
        tracks: ['Nightbus 18', 'Chrome District', 'Frozen Arp'],
        description: 'Three night-drive cues.',
      },
      {
        title: 'Last Stop',
        type: 'SINGLE',
        tracks: ['Last Stop'],
        description: 'End titles.',
      },
    ],
    collection: { name: 'Night Drive Scores', type: 'CUSTOM' },
    show: {
      name: 'Neon Shift',
      tagline: 'Hardware live set',
      showType: 'LIVE_SET',
      scheduleNote: 'Wednesdays 21:00 EET',
      episodes: [
        {
          title: 'Neon Shift 7',
          dayOffset: 3,
          startHourUtc: 18,
          durationHours: 1,
          venue: 'Kultuurikatel',
          location: 'Tallinn',
        },
      ],
    },
    radioSlot: {
      dayOffset: 3,
      startHourUtc: 18,
      durationHours: 1,
      note: 'Synthwave hardware live set',
      showType: 'LIVE_SET',
    },
  },
  {
    username: 'night-ferry',
    displayName: 'Night Ferry',
    bio: 'Riga lo-fi beats and cassette hiss. Harbour radios, cheap keys, late ferries.',
    fullBio:
      'Night Ferry samples harbour PA announcements and plays them back through a four-track. Most tracks are one evening, one tape.',
    countryCode: 'LV',
    genre: 'Lo-fi',
    visualPreset: 'BACKDROP_BOX',
    brandAccentId: 'deep',
    tracks: [
      { title: 'Ticket Window', genre: 'Lo-fi', durationSec: 178 },
      { title: 'Cabin Light', genre: 'Lo-fi', durationSec: 201 },
      { title: 'Wake', genre: 'Lo-fi', durationSec: 188 },
      { title: 'Deck 7', genre: 'Downtempo', durationSec: 224 },
      { title: 'Arrival Bell', genre: 'Lo-fi', durationSec: 165 },
    ],
    releases: [
      {
        title: 'Cabin Light',
        type: 'EP',
        tracks: ['Ticket Window', 'Cabin Light', 'Wake', 'Deck 7'],
        description: 'A cassette EP for the overnight crossing.',
      },
      {
        title: 'Arrival Bell',
        type: 'SINGLE',
        tracks: ['Arrival Bell'],
        description: 'The morning cut.',
      },
    ],
    collection: { name: 'Cassette Crossings', type: 'ALBUM' },
    show: {
      name: 'Overnight Mix',
      tagline: 'Lo-fi beats until docking',
      showType: 'LIVE_SET',
      scheduleNote: 'Overnight Fridays',
      episodes: [
        {
          title: 'Overnight Mix — Westbound',
          dayOffset: 4,
          startHourUtc: 21,
          durationHours: 2,
          location: 'Riga passenger port',
        },
      ],
    },
    radioSlot: {
      dayOffset: 4,
      startHourUtc: 21,
      durationHours: 1.5,
      note: 'Overnight lo-fi mix',
      showType: 'LIVE_SET',
    },
  },
]

const LEGACY_USERNAMES = [
  'mock-nova-drift',
  'mock-echo-harbor',
  'mock-tuuli-ren',
  'mock-dj-kaski',
  'mock-hiljainen',
  'mock-rautatie',
]

function colorsFor(brandAccentId: string): AlbumArtColors {
  const preset = BRAND_ACCENT_PRESETS.find((item) => item.id === brandAccentId)
  if (!preset) {
    return { bg: DEFAULT_BG, accent: '#22D3EE', highlight: '#A78BFA' }
  }
  return { bg: DEFAULT_BG, accent: preset.accent, highlight: preset.highlight }
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function atUtc(dayOffset: number, hourUtc: number): Date {
  const now = new Date()
  const base = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return new Date(base + dayOffset * 86_400_000 + hourUtc * 3_600_000)
}

function makeSilentWav(durationSec = 8, sampleRate = 8000): Buffer {
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

async function fetchPhotoJpeg(seed: string, width: number, height: number): Promise<Buffer | null> {
  try {
    const response = await fetch(
      `https://picsum.photos/seed/${encodeURIComponent(seed)}/${width}/${height}`,
      { redirect: 'follow' },
    )
    if (!response.ok) return null
    const buffer = Buffer.from(await response.arrayBuffer())
    return buffer.length > 800 ? buffer : null
  } catch {
    return null
  }
}

async function uploadPublicObject(
  key: string,
  body: string | Buffer,
  contentType: string,
): Promise<string> {
  if (typeof body === 'string') {
    await putObjectText(key, body, contentType)
  } else {
    await putObjectBuffer(key, body, contentType)
  }
  return publicMediaUrl(key)!
}

async function uploadCover(
  key: string,
  title: string,
  subtitle: string,
  genre: AlbumArtGenre,
  colors: AlbumArtColors,
): Promise<string> {
  return uploadPublicObject(
    key,
    generateAlbumArtSvg(title, subtitle, { genre, colors }),
    'image/svg+xml',
  )
}

async function uploadAvatar(username: string, displayName: string): Promise<string> {
  const key = `local-dev/${username}/avatar.jpg`
  const photo = await fetchPhotoJpeg(`${username}-portrait`, 800, 800)
  if (photo) return uploadPublicObject(key, photo, 'image/jpeg')
  return uploadPublicObject(
    `local-dev/${username}/avatar.svg`,
    generateAvatarSvg(username, displayName),
    'image/svg+xml',
  )
}

async function uploadBanner(
  username: string,
  genre: AlbumArtGenre,
  colors: AlbumArtColors,
): Promise<string> {
  const photo = await fetchPhotoJpeg(`${username}-banner`, 1600, 480)
  if (photo) {
    return uploadPublicObject(`local-dev/${username}/banner.jpg`, photo, 'image/jpeg')
  }
  return uploadPublicObject(
    `local-dev/${username}/banner.svg`,
    generateChannelBannerSvg(username, { genre, colors }),
    'image/svg+xml',
  )
}

async function uploadSlideshow(username: string, count: number): Promise<string[]> {
  const urls: string[] = []
  for (let index = 0; index < count; index++) {
    const photo = await fetchPhotoJpeg(`${username}-slide-${index}`, 1400, 900)
    if (!photo) continue
    urls.push(
      await uploadPublicObject(`local-dev/${username}/slideshow-${index}.jpg`, photo, 'image/jpeg'),
    )
  }
  return urls
}

async function deleteFixtureUser(username: string): Promise<void> {
  const existing = await prisma.user.findUnique({
    where: { username },
    select: { id: true, channel: { select: { id: true } } },
  })
  if (!existing) return
  if (existing.channel) {
    await prisma.curatedRotationItem.deleteMany({
      where: { archiveItem: { channelId: existing.channel.id } },
    })
  }
  await prisma.user.delete({ where: { id: existing.id } })
}

async function wipeLegacyFixtures(): Promise<void> {
  const usernames = new Set([...ARTISTS.map((artist) => artist.username), ...LEGACY_USERNAMES])
  for (const username of usernames) {
    await deleteFixtureUser(username)
  }

  const leftover = await prisma.user.findMany({
    where: {
      OR: [
        { email: { endsWith: `@${EMAIL_DOMAIN}` } },
        { email: { endsWith: `@${LEGACY_EMAIL_DOMAIN}` } },
      ],
    },
    select: { username: true },
  })
  for (const row of leftover) {
    await deleteFixtureUser(row.username)
  }
}

async function seedArtist(
  spec: ArtistSpec,
  index: number,
  passwordHash: string,
): Promise<{ channelId: string; archiveItemIds: string[] }> {
  const colors = colorsFor(spec.brandAccentId)
  const liveSourcePass = randomBytes(16).toString('hex')
  const rtmpStreamKey = randomBytes(16).toString('hex')
  const avatarUrl = await uploadAvatar(spec.username, spec.displayName)
  const bannerUrl = await uploadBanner(spec.username, spec.genre, colors)
  const slideshow = await uploadSlideshow(spec.username, 4)

  const artist = await prisma.user.create({
    data: {
      email: `${spec.username}@${EMAIL_DOMAIN}`,
      passwordHash,
      username: spec.username,
      displayName: spec.displayName,
      bio: spec.bio,
      fullBio: spec.fullBio,
      avatarUrl,
      countryCode: spec.countryCode,
      defaultLocation: spec.show.episodes[0]?.location,
      emailVerifiedAt: new Date(),
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 91000 + index,
      memberSince: new Date('2025-11-01'),
      membership: { create: { status: 'ACTIVE', activatedAt: new Date('2025-11-01') } },
      channel: {
        create: {
          slug: spec.username,
          liveSourceMount: `/live/${spec.username}`,
          liveSourcePass,
          liveSourcePassHash: await hashPassword(liveSourcePass),
          rtmpStreamKey,
          rtmpStreamKeyHash: await hashPassword(rtmpStreamKey),
          state: 'OFFLINE',
          fallbackMode: 'ordered',
          fallbackEnabled: true,
          visualPreset: spec.visualPreset,
          headerStyle: 'GRADIENT',
          brandAccentPreset: spec.brandAccentId,
          colorSchemeJson: JSON.stringify({
            bg: colors.bg,
            accent: colors.accent,
            text: '#E6E9F0',
            muted: '#A1A8BD',
            highlight: colors.highlight,
          }),
          videoBackgroundUrl: bannerUrl,
          slideshowImages: slideshow,
          galleryMode: slideshow.length > 0 ? 'STATIC_SLIDESHOW' : 'NONE',
          pressKitGalleryPublic: slideshow.length > 0,
          nextBroadcastAt: atUtc(
            spec.show.episodes.find((ep) => ep.dayOffset >= 0)?.dayOffset ?? 1,
            19,
          ),
          nextBroadcastNote: spec.show.scheduleNote,
        },
      },
    },
    include: { channel: true },
  })

  const channelId = artist.channel!.id

  for (const [slideIndex, url] of slideshow.entries()) {
    const imageKey = url.includes('/local-dev/')
      ? url.slice(url.indexOf('local-dev/'))
      : `local-dev/${spec.username}/slideshow-${slideIndex}.jpg`
    await prisma.pressKitImage.create({
      data: {
        channelId,
        imageKey,
        title: `${spec.displayName} press ${slideIndex + 1}`,
        position: slideIndex + 1,
      },
    })
  }

  const archiveItems: Record<string, { id: string; durationSec: number }> = {}
  const archiveItemIds: string[] = []

  for (const [trackIndex, track] of spec.tracks.entries()) {
    const coverUrl = await uploadCover(
      `local-dev/${spec.username}/tracks/${slugify(track.title)}.svg`,
      track.title,
      spec.displayName,
      spec.genre,
      colors,
    )
    const rawKey = `raw/${spec.username}/${trackIndex}.wav`
    const mp3Key = `mp3/${spec.username}/${trackIndex}.mp3`
    const item = await prisma.archiveItem.create({
      data: {
        channelId,
        title: track.title,
        artistName: spec.displayName,
        genre: track.genre,
        bannerUrl: coverUrl,
        backgroundUrl: bannerUrl,
        slideshowUrls: slideshow.slice(0, 3),
        rawKey,
        mp3Key,
        durationSec: track.durationSec,
        fileSizeBytes: BigInt(4_000_000 + trackIndex * 180_000),
        status: 'READY',
        isPublic: true,
        isFallback: track.contentType == null || track.contentType === 'TRACK',
        fallbackOrder: trackIndex,
        contentType: track.contentType ?? 'TRACK',
        license: 'CC_BY',
        qualityBadge: 'TRANSCODED',
        source: 'UPLOAD',
        visualPreset: spec.visualPreset,
        releasedAt: new Date(Date.UTC(2026, 2, 4 + trackIndex)),
      },
    })
    archiveItems[track.title] = { id: item.id, durationSec: track.durationSec }
    archiveItemIds.push(item.id)
    await Promise.all([
      uploadFixtureAudio(rawKey, 'audio/wav'),
      uploadFixtureAudio(mp3Key, 'audio/mpeg'),
    ])
  }

  for (const release of spec.releases) {
    const artworkUrl = await uploadCover(
      `local-dev/${spec.username}/releases/${slugify(release.title)}.svg`,
      release.title,
      spec.displayName,
      spec.genre,
      colors,
    )
    await prisma.release.create({
      data: {
        userId: artist.id,
        title: release.title,
        type: release.type,
        artworkUrl,
        releaseDate: new Date('2026-04-01'),
        description: release.description,
        smartLinkSlug: `${spec.username}-${slugify(release.title)}`,
        state: 'PUBLISHED',
        publishedAt: new Date('2026-04-01'),
        tracks: {
          create: release.tracks.map((title, trackPosition) => ({
            position: trackPosition + 1,
            title,
            durationSec: archiveItems[title]?.durationSec,
            archiveItemId: archiveItems[title]?.id,
          })),
        },
      },
    })
  }

  const collectionCover = await uploadCover(
    `local-dev/${spec.username}/collections/${slugify(spec.collection.name)}.svg`,
    spec.collection.name,
    spec.displayName,
    spec.genre,
    colors,
  )
  await prisma.collection.create({
    data: {
      userId: artist.id,
      slug: `${spec.username}-${slugify(spec.collection.name)}`,
      name: spec.collection.name,
      type: spec.collection.type,
      isPublic: true,
      isFeatured: true,
      description: `${spec.collection.name} — a public collection on ${spec.displayName}'s channel.`,
      coverUrl: collectionCover,
      items: {
        create: spec.tracks.slice(0, 4).map((track, position) => ({
          archiveItemId: archiveItems[track.title]!.id,
          position: position + 1,
        })),
      },
    },
  })

  const showArt = await uploadCover(
    `local-dev/${spec.username}/shows/${slugify(spec.show.name)}.svg`,
    spec.show.name,
    spec.displayName,
    spec.genre,
    colors,
  )
  const series = await prisma.liveShowSeries.create({
    data: {
      channelId,
      name: spec.show.name,
      description: spec.bio,
      tagline: spec.show.tagline,
      artworkUrl: showArt,
      showType: spec.show.showType,
      visibility: 'PUBLIC',
      autoArchive: true,
      episodeNumberEnabled: true,
      nextEpisodeNumber: spec.show.episodes.length + 1,
      intervalHours: 2,
      scheduleNote: spec.show.scheduleNote,
    },
  })

  for (const [episodeIndex, episode] of spec.show.episodes.entries()) {
    const startAt = atUtc(episode.dayOffset, episode.startHourUtc)
    const episodeArt = await uploadCover(
      `local-dev/${spec.username}/shows/${slugify(episode.title)}.svg`,
      episode.title,
      spec.show.name,
      spec.genre,
      colors,
    )
    const scheduled = await prisma.scheduledLiveShow.create({
      data: {
        channelId,
        seriesId: series.id,
        startAt,
        episodeNumber: episodeIndex + 1,
        title: episode.title,
        description: spec.show.tagline,
        tagline: spec.show.tagline,
        venue: episode.venue,
        location: episode.location,
        artworkUrl: episodeArt,
        showType: spec.show.showType,
        visibility: 'PUBLIC',
        autoArchive: true,
      },
    })

    const showTrack = spec.tracks.find(
      (track) => track.contentType && track.contentType !== 'TRACK',
    )
    await prisma.liveShowEpisode.create({
      data: {
        channelId,
        seriesId: series.id,
        episodeNumber: episodeIndex + 1,
        title: episode.title,
        description: spec.show.tagline,
        artworkUrl: episodeArt,
        status: episode.dayOffset < 0 ? 'APPROVED' : 'SCHEDULED',
        source: episode.dayOffset < 0 ? 'BROADCAST' : 'UPLOAD',
        archiveItemId: showTrack ? archiveItems[showTrack.title]?.id : undefined,
      },
    })
    void scheduled
  }

  const slotStart = atUtc(spec.radioSlot.dayOffset, spec.radioSlot.startHourUtc)
  await prisma.radioSlotBooking.create({
    data: {
      channelId,
      startAt: slotStart,
      endAt: new Date(slotStart.getTime() + spec.radioSlot.durationHours * 3_600_000),
      note: spec.radioSlot.note,
      showType: spec.radioSlot.showType,
    },
  })

  console.log(
    `seeded ${spec.displayName} (@${spec.username}) — ${spec.tracks.length} tracks, ${spec.releases.length} releases, ${spec.show.episodes.length} shows`,
  )
  return { channelId, archiveItemIds }
}

async function attachRadioRotation(archiveItemIds: string[], addedById: string): Promise<void> {
  const radio = await prisma.channel.findUnique({
    where: { slug: TAHTI_RADIO_SLUG },
    select: { id: true },
  })
  if (!radio) {
    console.warn('Tahti Radio channel missing — skip curated rotation')
    return
  }

  let position =
    (
      await prisma.curatedRotationItem.findFirst({
        where: { channelId: radio.id },
        orderBy: { position: 'desc' },
        select: { position: true },
      })
    )?.position ?? -1

  for (const archiveItemId of archiveItemIds.slice(0, 12)) {
    const existing = await prisma.curatedRotationItem.findUnique({
      where: { channelId_archiveItemId: { channelId: radio.id, archiveItemId } },
      select: { id: true },
    })
    if (existing) continue
    position += 1
    await prisma.curatedRotationItem.create({
      data: {
        channelId: radio.id,
        archiveItemId,
        position,
        addedById,
      },
    })
  }
}

async function main() {
  const passwordHash = await hashPassword(PASS)
  await wipeLegacyFixtures()

  const rotationIds: string[] = []
  let firstUserId: string | null = null

  for (const [index, spec] of ARTISTS.entries()) {
    const seeded = await seedArtist(spec, index, passwordHash)
    rotationIds.push(...seeded.archiveItemIds.filter((_, itemIndex) => itemIndex % 2 === 0))
    if (index === 0) {
      const user = await prisma.user.findUnique({
        where: { username: spec.username },
        select: { id: true },
      })
      firstUserId = user?.id ?? null
    }
  }

  if (firstUserId) {
    await attachRadioRotation(rotationIds, firstUserId)
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        artists: ARTISTS.length,
        password: PASS,
        login: `${ARTISTS[0]!.username}@${EMAIL_DOMAIN}`,
        profiles: ARTISTS.map((artist) => `/u/${artist.username}`),
        channels: ARTISTS.map((artist) => `/channel/${artist.username}`),
      },
      null,
      2,
    ),
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
