// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import {
  completeChannelBlockLogoUpload,
  createChannelBlock,
  deleteChannelBlock,
  fetchChannelBlocks,
  patchChannelBlock,
  prepareChannelBlockLogoUpload,
} from '@/lib/channel-blocks-client'

export async function listChannelBlocks() {
  return fetchChannelBlocks()
}

export async function addChannelBlock(type: 'LOGO' | 'ADDON', configJson: Record<string, unknown>) {
  return createChannelBlock(type, configJson)
}

export async function patchChannelBlockAction(
  id: string,
  patch: {
    width?: 'FULL' | 'HALF' | 'THIRD'
    position?: number
    configJson?: Record<string, unknown>
  },
) {
  return patchChannelBlock(id, patch)
}

export async function removeChannelBlock(id: string) {
  return deleteChannelBlock(id)
}

export async function prepareChannelBlockLogo(body: { filename: string; contentType: string }) {
  return prepareChannelBlockLogoUpload(body)
}

export async function completeChannelBlockLogo(uploadKey: string) {
  return completeChannelBlockLogoUpload(uploadKey)
}
