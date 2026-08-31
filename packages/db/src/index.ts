// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export * from '@prisma/client'
export { ensureInitialVersion, syncActiveVersionToItem } from './archive-versions.js'
export {
  ensureInitialReleaseTrackVersion,
  syncActiveVersionToTrack,
} from './release-track-versions.js'
export {
  notifyFollowersOfNewPost,
  notifyFollowersOfNewTrack,
  notifyFollowersOfNewRelease,
  notifyArtistOfNewFollower,
  notifyArtistOfNewLike,
  notifyArtistOfNewRepost,
  notifyPlaylistOfNewTrack,
  notifyUserOfNewMessage,
  notifyUsersOfChatMention,
  notifyArtistOfRadioSubmissionRejected,
  notifyUserThemeUnderReview,
  notifyUserThemeApproved,
  notifyUserThemeRejected,
  notifyUserAdminTest,
  notifyBoardOfMissedLiveShow,
  processScheduledPostNotifications,
} from './notifications.js'
export { closeStaleListenSessions } from './listen-sessions.js'
export {
  encryptIntegrationFields,
  decryptIntegrationFields,
  getUserIntegrationCredential,
  upsertUserIntegrationCredential,
  removeUserIntegrationCredential,
} from './integration-credentials.js'
export {
  generateForSeries,
  syncNextBroadcast,
  getActiveRestriction,
  restrictionErrorMessage,
  type RecurringSeriesInput,
  type ActiveRestriction,
} from './live-show-recurrence.js'
