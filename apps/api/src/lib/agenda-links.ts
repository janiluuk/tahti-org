// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

type Links = { meetingId: string | null; agendaItemId: string | null }

/**
 * The meeting and agenda item a record (resolution, document) ends up linked
 * to. An agenda item implies its meeting; a different meeting named with it is
 * an error. Moving the record to another meeting drops an item of the old one.
 */
export async function resolveAgendaLinks(
  prisma: PrismaClient,
  requested: { meetingId?: string | null; agendaItemId?: string | null },
  current: Links,
): Promise<Links | { error: string }> {
  let meetingId = requested.meetingId !== undefined ? requested.meetingId : current.meetingId
  let agendaItemId =
    requested.agendaItemId !== undefined ? requested.agendaItemId : current.agendaItemId
  if (agendaItemId) {
    const item = await prisma.governanceAgendaItem.findUnique({
      where: { id: agendaItemId },
      select: { meetingId: true },
    })
    if (!item) return { error: 'Agenda item not found' }
    if (requested.agendaItemId !== undefined) {
      if (requested.meetingId && requested.meetingId !== item.meetingId) {
        return { error: 'That agenda item belongs to another meeting' }
      }
      meetingId = item.meetingId
    } else if (meetingId !== item.meetingId) {
      agendaItemId = null
    }
  }
  if (meetingId && meetingId !== current.meetingId) {
    const meeting = await prisma.governanceMeeting.findUnique({
      where: { id: meetingId },
      select: { id: true },
    })
    if (!meeting) return { error: 'Meeting not found' }
  }
  return { meetingId, agendaItemId }
}
