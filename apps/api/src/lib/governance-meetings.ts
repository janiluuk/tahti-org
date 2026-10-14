// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { presignedGetUrl } from './minio.js'

export const MEETING_HELD = 'The meeting is under a legal hold and cannot be changed'

export async function meetingResponse(meeting: {
  id: string
  title: string
  type: string
  state: string
  scheduledAt: Date | null
  location: string | null
  remoteUrl: string | null
  noticeAt: Date | null
  agenda: unknown
  minutesKey: string | null
  minutesApprovedAt: Date | null
  minutesRedacted: boolean
  minutesPublishedAt: Date | null
  minutesSignedByName: string | null
  minutesSignedAt: Date | null
  legalHoldAt: Date | null
  legalHoldReason: string | null
  eligibleMemberCount: number | null
  quorumRequired: number | null
  chairName: string | null
  secretaryName: string | null
  createdAt: Date
  updatedAt: Date
  attendance: Array<{ status: string }>
}) {
  const presentCount = meeting.attendance.filter((record) => record.status === 'PRESENT').length
  return {
    ...meeting,
    attendance: undefined,
    minutesUrl: meeting.minutesKey
      ? await presignedGetUrl(meeting.minutesKey, 3600, 'minutes.pdf').catch(() => null)
      : null,
    attendanceCount: meeting.attendance.length,
    presentCount,
    quorumMet: meeting.quorumRequired === null ? null : presentCount >= meeting.quorumRequired,
  }
}
