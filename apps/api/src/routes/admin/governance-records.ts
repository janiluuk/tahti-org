// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { Prisma } from '@tahti/db'
import {
  CreateGovernanceConflictDeclarationSchema,
  CreateGovernanceDocumentSchema,
  CreateGovernanceMeetingSchema,
  GovernanceAttendanceListSchema,
  GovernanceConflictDeclarationListSchema,
  GovernanceDocumentListSchema,
  GovernanceMeetingListSchema,
  GovernanceNoticeDeliveryListSchema,
  PatchGovernanceMeetingSchema,
  PrepareMinutesUploadResponseSchema,
  PrepareMinutesUploadSchema,
  UpsertGovernanceAttendanceSchema,
  openApiResponse,
  openApiResponses,
} from '@tahti/shared'
import { requireBoard, requireMember } from '../../plugins/auth.js'
import { presignedGetUrl, presignedPutUrl } from '../../lib/minio.js'
import { auditLog } from '../../lib/audit.js'
import { sendMeetingNoticeAndRecordDeliveries } from '../../lib/governance-notice.js'

const MINUTES_PRESIGN_TTL_SEC = 900

async function documentResponse(document: {
  id: string
  title: string
  type: string
  description: string | null
  version: number
  effectiveAt: Date | null
  publishedAt: Date | null
  meetingId: string | null
  storageKey: string | null
  externalUrl: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: document.id,
    title: document.title,
    type: document.type,
    description: document.description,
    version: document.version,
    effectiveAt: document.effectiveAt,
    publishedAt: document.publishedAt,
    meetingId: document.meetingId,
    downloadUrl: document.storageKey
      ? await presignedGetUrl(document.storageKey, 3600).catch(() => null)
      : null,
    externalUrl: document.externalUrl,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  }
}

async function meetingResponse(meeting: {
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

function pagination(request: { query?: unknown }) {
  const query = (request.query ?? {}) as { limit?: string; cursor?: string }
  const parsedLimit = Number(query.limit)
  return {
    cursor: query.cursor?.trim() || undefined,
    limit: Number.isInteger(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 50,
  }
}

function nextCursor(
  reply: { header: (name: string, value: string) => unknown },
  rows: Array<{ id: string }>,
  limit: number,
) {
  if (rows.length > limit) {
    const page = rows.slice(0, limit)
    reply.header('x-next-cursor', page.at(-1)!.id)
    return page
  }
  return rows
}

const governanceRecordsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/governance/meetings',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponse(GovernanceMeetingListSchema, 'GovernanceMeetingList'),
      },
    },
    async (request, reply) => {
      const { cursor, limit } = pagination(request)
      const meetings = await fastify.prisma.governanceMeeting.findMany({
        where: { state: { not: 'DRAFT' } },
        orderBy: { scheduledAt: 'desc' },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        take: limit + 1,
        include: { attendance: { select: { status: true } } },
      })
      return reply.send(
        nextCursor(reply, await Promise.all(meetings.map(meetingResponse)), limit),
      )
    },
  )

  fastify.get(
    '/api/v1/governance/documents',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponse(GovernanceDocumentListSchema, 'GovernanceDocumentList'),
      },
    },
    async (request, reply) => {
      const { cursor, limit } = pagination(request)
      const documents = await fastify.prisma.governanceDocument.findMany({
        where: { publishedAt: { not: null } },
        orderBy: [{ type: 'asc' }, { effectiveAt: 'desc' }, { version: 'desc' }],
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        take: limit + 1,
      })
      const rows = await Promise.all(documents.map(documentResponse))
      return reply.send(nextCursor(reply, rows, limit))
    },
  )

  fastify.get(
    '/api/admin/governance/meetings',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(GovernanceMeetingListSchema, 'AdminGovernanceMeetingList'),
      },
    },
    async (request, reply) => {
      const { cursor, limit } = pagination(request)
      const meetings = await fastify.prisma.governanceMeeting.findMany({
        orderBy: { scheduledAt: 'desc' },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        take: limit + 1,
        include: { attendance: { select: { status: true } } },
      })
      return reply.send(
        nextCursor(reply, await Promise.all(meetings.map(meetingResponse)), limit),
      )
    },
  )

  fastify.post(
    '/api/admin/governance/meetings',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponses([
          { status: 201, schema: GovernanceMeetingListSchema.element, name: 'GovernanceMeeting' },
        ]),
      },
    },
    async (request, reply) => {
      const parsed = CreateGovernanceMeetingSchema.safeParse(request.body)
      if (!parsed.success)
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      const body = parsed.data
      const meeting = await fastify.prisma.governanceMeeting.create({
        data: { ...body, agenda: body.agenda ?? undefined, createdById: request.sessionUser!.id },
      })
      await auditLog(fastify.prisma, {
        action: 'MEETING_CREATE',
        actorId: request.sessionUser!.id,
        targetId: meeting.id,
        meta: { title: meeting.title, type: meeting.type, state: meeting.state },
      })
      if (meeting.noticeAt) {
        await auditLog(fastify.prisma, {
          action: 'MEETING_NOTICE_PUBLISH',
          actorId: request.sessionUser!.id,
          targetId: meeting.id,
          meta: { noticeAt: meeting.noticeAt, eligibleMemberCount: meeting.eligibleMemberCount },
        })
        const recipientCount = await sendMeetingNoticeAndRecordDeliveries(fastify.prisma, meeting)
        await auditLog(fastify.prisma, {
          action: 'MEETING_NOTICE_SEND',
          actorId: request.sessionUser!.id,
          targetId: meeting.id,
          meta: { recipientCount },
        })
      }
      return reply.status(201).send({
        ...meeting,
        attendanceCount: 0,
        presentCount: 0,
        quorumMet: body.quorumRequired ? false : null,
        chairName: meeting.chairName ?? null,
        secretaryName: meeting.secretaryName ?? null,
        minutesSignedByName: meeting.minutesSignedByName ?? null,
        minutesSignedAt: meeting.minutesSignedAt ?? null,
        minutesUrl: null,
      })
    },
  )

  fastify.patch(
    '/api/admin/governance/meetings/:id',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(GovernanceMeetingListSchema.element, 'GovernanceMeeting'),
      },
    },
    async (request, reply) => {
      const id = (request.params as { id?: string }).id
      if (!id) return reply.status(400).send({ error: 'Meeting id is required' })
      const parsed = PatchGovernanceMeetingSchema.safeParse(request.body)
      if (!parsed.success)
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      const meeting = await fastify.prisma.governanceMeeting.findUnique({ where: { id } })
      if (!meeting) return reply.status(404).send({ error: 'Meeting not found' })
      const updated = await fastify.prisma.governanceMeeting.update({
        where: { id },
        data: {
          ...parsed.data,
          agenda: parsed.data.agenda === null ? Prisma.JsonNull : parsed.data.agenda,
        },
      })
      await auditLog(fastify.prisma, {
        action: 'MEETING_UPDATE',
        actorId: request.sessionUser!.id,
        targetId: updated.id,
        meta: { title: updated.title, state: updated.state },
      })
      if ('noticeAt' in parsed.data && updated.noticeAt) {
        await auditLog(fastify.prisma, {
          action: 'MEETING_NOTICE_PUBLISH',
          actorId: request.sessionUser!.id,
          targetId: updated.id,
          meta: { noticeAt: updated.noticeAt, eligibleMemberCount: updated.eligibleMemberCount },
        })
        // Only send/record on the first publish (noticeAt going from unset to
        // set) — re-saving the same meeting shouldn't re-email every member.
        // A deliberately changed notice date is a new MEETING_UPDATE, not
        // re-triggered here; board can re-publish by clearing then resetting
        // noticeAt if a real re-notify is intended.
        if (!meeting.noticeAt) {
          const recipientCount = await sendMeetingNoticeAndRecordDeliveries(fastify.prisma, updated)
          await auditLog(fastify.prisma, {
            action: 'MEETING_NOTICE_SEND',
            actorId: request.sessionUser!.id,
            targetId: updated.id,
            meta: { recipientCount },
          })
        }
      }
      if ('minutesKey' in parsed.data && updated.minutesKey) {
        await auditLog(fastify.prisma, {
          action: 'MINUTES_UPLOAD',
          actorId: request.sessionUser!.id,
          targetId: updated.id,
          meta: { minutesKey: updated.minutesKey },
        })
      }
      if ('minutesApprovedAt' in parsed.data && updated.minutesApprovedAt) {
        await auditLog(fastify.prisma, {
          action: 'MINUTES_APPROVE',
          actorId: request.sessionUser!.id,
          targetId: updated.id,
          meta: { minutesApprovedAt: updated.minutesApprovedAt },
        })
      }
      if (
        ('minutesSignedByName' in parsed.data || 'minutesSignedAt' in parsed.data) &&
        updated.minutesSignedByName &&
        updated.minutesSignedAt
      ) {
        await auditLog(fastify.prisma, {
          action: 'MINUTES_SIGN',
          actorId: request.sessionUser!.id,
          targetId: updated.id,
          meta: {
            minutesSignedByName: updated.minutesSignedByName,
            minutesSignedAt: updated.minutesSignedAt,
          },
        })
      }
      if ('minutesRedacted' in parsed.data && updated.minutesRedacted && !meeting.minutesRedacted) {
        await auditLog(fastify.prisma, {
          action: 'MINUTES_REDACT',
          actorId: request.sessionUser!.id,
          targetId: updated.id,
          meta: { minutesKey: updated.minutesKey },
        })
      }
      if ('minutesPublishedAt' in parsed.data && updated.minutesPublishedAt) {
        await auditLog(fastify.prisma, {
          action: 'MINUTES_PUBLISH',
          actorId: request.sessionUser!.id,
          targetId: updated.id,
          meta: {
            minutesPublishedAt: updated.minutesPublishedAt,
            redacted: updated.minutesRedacted,
          },
        })
      }
      const withAttendance = await fastify.prisma.governanceMeeting.findUniqueOrThrow({
        where: { id: updated.id },
        include: { attendance: { select: { status: true } } },
      })
      return reply.send(await meetingResponse(withAttendance))
    },
  )

  // POST /api/admin/governance/meetings/:id/minutes/prepare-upload — presigned
  // PUT for the minutes file. The client PUTs the bytes directly to storage,
  // then finalizes by PATCHing the meeting with { minutesKey } (existing
  // route above already audits that as MINUTES_UPLOAD).
  fastify.post(
    '/api/admin/governance/meetings/:id/minutes/prepare-upload',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(PrepareMinutesUploadResponseSchema, 'PrepareMinutesUpload'),
      },
    },
    async (request, reply) => {
      const id = (request.params as { id?: string }).id
      if (!id) return reply.status(400).send({ error: 'Meeting id is required' })
      const parsed = PrepareMinutesUploadSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const meeting = await fastify.prisma.governanceMeeting.findUnique({ where: { id } })
      if (!meeting) return reply.status(404).send({ error: 'Meeting not found' })

      const minutesKey = `governance/meetings/${id}/minutes-${Date.now()}.pdf`
      const uploadUrl = await presignedPutUrl(
        minutesKey,
        parsed.data.contentType,
        MINUTES_PRESIGN_TTL_SEC,
        parsed.data.fileSizeBytes,
      )
      const expiresAt = new Date(Date.now() + MINUTES_PRESIGN_TTL_SEC * 1000).toISOString()
      return reply.send({ uploadUrl, minutesKey, expiresAt })
    },
  )

  fastify.get(
    '/api/admin/governance/meetings/:id/notice-deliveries',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(
          GovernanceNoticeDeliveryListSchema,
          'GovernanceNoticeDeliveryList',
        ),
      },
    },
    async (request, reply) => {
      const meetingId = (request.params as { id?: string }).id
      if (!meetingId) return reply.status(400).send({ error: 'Meeting id is required' })
      const records = await fastify.prisma.governanceNoticeDelivery.findMany({
        where: { meetingId },
        orderBy: { sentAt: 'asc' },
        include: { member: { select: { displayName: true } } },
      })
      return reply.send(
        records.map((r) => ({
          id: r.id,
          memberId: r.memberId,
          displayName: r.member.displayName,
          email: r.email,
          sentAt: r.sentAt,
          bouncedAt: r.bouncedAt,
        })),
      )
    },
  )

  fastify.get(
    '/api/admin/governance/meetings/:id/attendance',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(GovernanceAttendanceListSchema, 'GovernanceAttendanceList'),
      },
    },
    async (request, reply) => {
      const meetingId = (request.params as { id?: string }).id
      if (!meetingId) return reply.status(400).send({ error: 'Meeting id is required' })
      const records = await fastify.prisma.governanceAttendance.findMany({
        where: { meetingId },
        orderBy: { displayName: 'asc' },
      })
      return reply.send(records)
    },
  )

  fastify.post(
    '/api/admin/governance/meetings/:id/attendance',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponses([
          {
            status: 201,
            schema: GovernanceAttendanceListSchema.element,
            name: 'GovernanceAttendance',
          },
        ]),
      },
    },
    async (request, reply) => {
      const meetingId = (request.params as { id?: string }).id
      if (!meetingId) return reply.status(400).send({ error: 'Meeting id is required' })
      const parsed = UpsertGovernanceAttendanceSchema.safeParse(request.body)
      if (!parsed.success)
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      const meeting = await fastify.prisma.governanceMeeting.findUnique({
        where: { id: meetingId },
      })
      if (!meeting) return reply.status(404).send({ error: 'Meeting not found' })
      const existing = parsed.data.memberId
        ? await fastify.prisma.governanceAttendance.findFirst({
            where: { meetingId, memberId: parsed.data.memberId },
          })
        : null
      const record = existing
        ? await fastify.prisma.governanceAttendance.update({
            where: { id: existing.id },
            data: parsed.data,
          })
        : await fastify.prisma.governanceAttendance.create({ data: { meetingId, ...parsed.data } })
      await auditLog(fastify.prisma, {
        action: 'MEETING_ATTENDANCE_UPSERT',
        actorId: request.sessionUser!.id,
        targetId: meetingId,
        meta: { attendanceId: record.id, status: record.status, memberId: record.memberId },
      })
      return reply.status(existing ? 200 : 201).send(record)
    },
  )

  fastify.get(
    '/api/admin/governance/meetings/:id/conflicts',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(
          GovernanceConflictDeclarationListSchema,
          'GovernanceConflictDeclarationList',
        ),
      },
    },
    async (request, reply) => {
      const meetingId = (request.params as { id?: string }).id
      if (!meetingId) return reply.status(400).send({ error: 'Meeting id is required' })
      const records = await fastify.prisma.governanceConflictDeclaration.findMany({
        where: { meetingId },
        orderBy: { declaredAt: 'asc' },
      })
      return reply.send(records)
    },
  )

  fastify.post(
    '/api/admin/governance/meetings/:id/conflicts',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponses([
          {
            status: 201,
            schema: GovernanceConflictDeclarationListSchema.element,
            name: 'GovernanceConflictDeclaration',
          },
        ]),
      },
    },
    async (request, reply) => {
      const meetingId = (request.params as { id?: string }).id
      if (!meetingId) return reply.status(400).send({ error: 'Meeting id is required' })
      const parsed = CreateGovernanceConflictDeclarationSchema.safeParse(request.body)
      if (!parsed.success)
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      const meeting = await fastify.prisma.governanceMeeting.findUnique({
        where: { id: meetingId },
      })
      if (!meeting) return reply.status(404).send({ error: 'Meeting not found' })
      const record = await fastify.prisma.governanceConflictDeclaration.create({
        data: { meetingId, ...parsed.data },
      })
      await auditLog(fastify.prisma, {
        action: 'CONFLICT_DECLARE',
        actorId: request.sessionUser!.id,
        targetId: meetingId,
        meta: {
          conflictId: record.id,
          displayName: record.displayName,
          recused: record.recused,
        },
      })
      return reply.status(201).send(record)
    },
  )

  fastify.get(
    '/api/admin/governance/documents',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(GovernanceDocumentListSchema, 'AdminGovernanceDocumentList'),
      },
    },
    async (_request, reply) => {
      const documents = await fastify.prisma.governanceDocument.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
      })
      return reply.send(await Promise.all(documents.map(documentResponse)))
    },
  )

  fastify.post(
    '/api/admin/governance/documents',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponses([
          { status: 201, schema: GovernanceDocumentListSchema.element, name: 'GovernanceDocument' },
        ]),
      },
    },
    async (request, reply) => {
      const parsed = CreateGovernanceDocumentSchema.safeParse(request.body)
      if (!parsed.success)
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      const document = await fastify.prisma.governanceDocument.create({
        data: { ...parsed.data, createdById: request.sessionUser!.id },
      })
      await auditLog(fastify.prisma, {
        action: 'DOCUMENT_CREATE',
        actorId: request.sessionUser!.id,
        targetId: document.id,
        meta: { title: document.title, type: document.type, version: document.version },
      })
      return reply.status(201).send(await documentResponse(document))
    },
  )
}

export default governanceRecordsRoutes
