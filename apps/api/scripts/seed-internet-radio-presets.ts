// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Seeds the starter internet radio preset catalog (six Finnish stations).
 * Stream URLs and self-hosted logos are verified; programmingUrl points at
 * each station's public schedule / homepage.
 *
 * Run (prod): ssh vimage, then:
 *   docker compose exec api tsx apps/api/scripts/seed-internet-radio-presets.ts
 */

import { prisma } from '@tahti/db'

const PRESETS = [
  {
    name: 'YleX',
    genre: 'Pop / Hits',
    description: 'Finnish youth-focused pop and hits station.',
    iconUrl:
      'https://images.cdn.yle.fi/f_auto,w_512,h_512,c_fit/v1496664710/yle-areena-app.png',
    programmingUrl: 'https://areena.yle.fi/audio/ohjelmat/yle-x',
    streamUrl: 'https://icecast.live.yle.fi/radio/YleX/icecast.audio',
    enabled: true,
  },
  {
    name: 'Radio Helsinki',
    genre: 'Talk / Variety',
    description: 'Helsinki-area talk and variety station.',
    iconUrl: 'https://cdn.tahti.live/tahti/media/yaniho/e2vB956jDL.png',
    programmingUrl: 'https://www.radiohelsinki.fi/ohjelmakartta/',
    streamUrl: 'https://stream.radiohelsinki.fi/stream',
    enabled: true,
  },
  {
    name: 'Radio Rock',
    genre: 'Rock',
    description: 'Finnish rock radio station.',
    iconUrl:
      'https://static.novelist.nelonenmedia.fi/files/styles/1_360x360/s3/promo-items/square/2024/RadioRock_2560x2560.jpg?itok=-t2L8AEt',
    programmingUrl: 'https://www.radiorock.fi/',
    streamUrl:
      'https://aud-stream-radiorock.nm-elemental.nelonenmedia.fi/playlist.m3u8',
    enabled: true,
  },
  {
    name: 'Suomipop',
    genre: 'Pop',
    description: 'Finnish contemporary pop station.',
    iconUrl:
      'https://static.novelist.nelonenmedia.fi/files/styles/1_360x360/s3/promo-items/square/2024/Suomipop_2560x2560.jpg?itok=PbwAfqXn',
    programmingUrl: 'https://www.supla.fi/suomipop',
    streamUrl:
      'https://aud-stream-suomipop.nm-elemental.nelonenmedia.fi/playlist.m3u8',
    enabled: true,
  },
  {
    name: 'NRJ',
    genre: 'Pop / Hits',
    description: 'Hit music radio for Finland.',
    iconUrl: 'https://listenapi.planetradio.co.uk/cdn/logos/1-1/450x450/334.jpg',
    programmingUrl: 'https://www.radioplay.fi/nrj',
    streamUrl:
      'https://stream-redirect.bauermedia.fi/nrj/nrj_64.aac?aw_0_1st.bauer_loggedin=false&aw_0_1st.playerid=BMUK_tunein',
    enabled: true,
  },
  {
    name: 'Radio Nova',
    genre: 'Pop',
    description: 'Mainstream Finnish pop radio.',
    iconUrl: 'https://assets.planetradio.co.uk/img/ConfigLockScreenImageUrl/254.jpg',
    programmingUrl: 'https://www.radioplay.fi/radio-nova',
    streamUrl:
      'https://stream-redirect.bauermedia.fi/radionova/radionova_64.aac?aw_0_1st.bauer_loggedin=false&aw_0_1st.playerid=BMUK_tunein',
    enabled: true,
  },
]

async function main() {
  const results = []
  for (const preset of PRESETS) {
    const existing = await prisma.internetRadioPreset.findFirst({ where: { name: preset.name } })
    const row = existing
      ? await prisma.internetRadioPreset.update({ where: { id: existing.id }, data: preset })
      : await prisma.internetRadioPreset.create({ data: preset })
    results.push({ id: row.id, name: row.name, enabled: row.enabled })
  }
  console.log(JSON.stringify({ ok: true, seeded: results }, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
