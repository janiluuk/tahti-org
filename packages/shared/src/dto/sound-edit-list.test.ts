// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { createDefaultEditList } from '@tahti/audio-edit'
import { SoundEditListDraftPatchSchema, SoundEditListRenderSchema } from './sound-edit-list.js'

describe('SoundEditList schemas accept default editList', () => {
  const editList = createDefaultEditList(60)

  it('render schema accepts default editList', () => {
    const parsed = SoundEditListRenderSchema.safeParse({
      editList,
      versionLabel: 'test',
      activate: false,
      format: 'flac',
    })
    expect(parsed.success).toBe(true)
  })

  it('draft patch schema accepts default editList with expectedUpdatedAt', () => {
    const parsed = SoundEditListDraftPatchSchema.safeParse({
      editList,
      expectedUpdatedAt: new Date().toISOString(),
    })
    expect(parsed.success).toBe(true)
  })
})
