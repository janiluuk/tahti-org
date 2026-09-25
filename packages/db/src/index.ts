// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { PrismaClient, type Prisma } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

/** Queries at or above this duration are logged as `slow_query`; 0 disables. */
const slowQueryMs = parseInt(process.env.PRISMA_SLOW_QUERY_MS ?? '200', 10)

function createPrismaClient(): PrismaClient {
  if (process.env.NODE_ENV === 'development') {
    return new PrismaClient({ log: ['query', 'error', 'warn'] })
  }
  if (!(slowQueryMs > 0)) return new PrismaClient({ log: ['error'] })

  const client = new PrismaClient({
    log: [{ emit: 'event', level: 'query' }, 'error'],
  })
  client.$on('query', (e: Prisma.QueryEvent) => {
    if (e.duration < slowQueryMs) return
    // Params are deliberately omitted: they can carry user data.
    console.warn(
      JSON.stringify({
        event: 'slow_query',
        durationMs: e.duration,
        query: e.query.slice(0, 1000),
      }),
    )
  })
  return client as unknown as PrismaClient
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export * from '@prisma/client'
export { ensureInitialVersion, syncActiveVersionToItem } from './sound-versions.js'
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
  notifyArtistStreamingCopyReady,
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
