// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { interleaveAnnouncements } from './fallback-playlist.js'
import {
  AnnouncementVoiceSettingsSchema,
  ApplyAnnouncementEditorSchema,
} from './dto/announcements.js'

const track = (id: string) => ({ id, title: id, playbackKey: `${id}.wav`, durationSec: 10 })
const programs = ['a', 'b', 'c', 'd'].map(track)
describe('owner clip placement', () => {
  it('takes turns instead of stacking every eligible clip', () => {
    const clips = ['id', 'link'].map((id) => ({
      ...track(id),
      scheduleMode: 'AFTER_EVERY' as const,
    }))
    expect(interleaveAnnouncements(programs, [], clips).map((c) => c.id)).toEqual([
      'a',
      'id',
      'b',
      'link',
      'c',
      'id',
      'd',
      'link',
    ])
  })
  it('counts whole programs for recurring links', () => {
    const clips = [{ ...track('id'), scheduleMode: 'EVERY_NTH' as const, everyNth: 2 }]
    expect(interleaveAnnouncements(programs, [], clips).map((c) => c.id)).toEqual([
      'a',
      'b',
      'id',
      'c',
      'd',
      'id',
    ])
  })
  it('anchors before and after by identity and ignores missing targets', () => {
    const clips = [
      { ...track('intro'), placement: 'BEFORE', targetSoundId: 'b' },
      { ...track('outro'), placement: 'AFTER', targetSoundId: 'b' },
      { ...track('missing'), placement: 'BEFORE', targetSoundId: 'removed' },
    ]
    expect(interleaveAnnouncements(programs, [], clips).map((c) => c.id)).toEqual([
      'a',
      'intro',
      'b',
      'outro',
      'c',
      'd',
    ])
  })
  it('rejects invalid renders and missing placement targets', () => {
    expect(
      AnnouncementVoiceSettingsSchema.safeParse({ startSec: 1, endSec: 2, fadeInSec: 2 }).success,
    ).toBe(false)
    expect(
      AnnouncementVoiceSettingsSchema.safeParse({ startSec: 0, endSec: Infinity }).success,
    ).toBe(false)
    expect(
      ApplyAnnouncementEditorSchema.safeParse({
        title: 'ID',
        renderToken: 'token',
        isEnabled: true,
        placement: 'BEFORE',
        targetSoundId: null,
        scheduleMode: 'AFTER_EVERY',
        everyNth: null,
      }).success,
    ).toBe(false)
  })
})
