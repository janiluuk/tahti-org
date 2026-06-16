// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { createDefaultEditList } from '@tahti/audio-edit'
import {
  ArchiveEditListDraftPatchSchema,
  ArchiveEditListRenderSchema,
} from './archive-edit-list.js'

describe('ArchiveEditList schemas accept default editList', () => {
  const editList = createDefaultEditList(60)

  it('render schema accepts default editList', () => {
    const parsed = ArchiveEditListRenderSchema.safeParse({
      editList,
      versionLabel: 'test',
      activate: false,
      format: 'flac',
    })
    expect(parsed.success).toBe(true)
  })

  it('draft patch schema accepts default editList with expectedUpdatedAt', () => {
    const parsed = ArchiveEditListDraftPatchSchema.safeParse({
      editList,
      expectedUpdatedAt: new Date().toISOString(),
    })
    expect(parsed.success).toBe(true)
  })

  it('render schema accepts editList without optional defaults stripped', () => {
    const { highPassHz: _hp, lowPassHz: _lp, limiter: _lim, ...stripped } = editList
    const parsed = ArchiveEditListRenderSchema.safeParse({
      editList: stripped,
      versionLabel: 'test',
      activate: false,
      format: 'flac',
    })
    expect(parsed.success).toBe(true)
  })
})
