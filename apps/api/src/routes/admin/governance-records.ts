// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { Prisma } from '@tahti/db'
import {
  CreateGovernanceConflictDeclarationSchema,
  CreateGovernanceDocumentSchema,
  CreateGovernanceMeetingSchema,
  IdParamSchema,
  parseRouteParams,
  GovernanceAttendanceListSchema,
  GovernanceConflictDeclarationListSchema,
  GovernanceDocumentListSchema,
  GovernanceMeetingListSchema,
  GovernanceNoticeDeliveryListSchema,
  PatchGovernanceDocumentSchema,
  PatchGovernanceMeetingSchema,
  PrepareMinutesUploadResponseSchema,
  PrepareMinutesUploadSchema,
  UpsertGovernanceAttendanceSchema,
  openApiResponse,
  openApiResponses,
} from '@tahti/shared'
import { requireBoard, requireMember } from '../../plugins/auth.js'
import { presignedPutUrl } from '../../lib/minio.js'
import { documentResponse } from '../../lib/governance-documents.js'
import { MEETING_HELD, meetingResponse } from '../../lib/governance-meetings.js'
import { auditLog } from '../../lib/audit.js'
import { resolveAgendaLinks } from '../../lib/agenda-links.js'
import { sendMeetingNoticeAndRecordDeliveries } from '../../lib/governance-notice.js'

const MINUTES_PRESIGN_TTL_SEC = 900

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
      const rows = await Promise.all(
        meetings.map((meeting) => meetingResponse({ ...meeting, legalHoldReason: null })),
      )
      return reply.send(nextCursor(reply, rows, limit))
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
        where: { publishedAt: { not: null }, archivedAt: null },
        orderBy: [{ type: 'asc' }, { effectiveAt: 'desc' }, { version: 'desc' }],
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        take: limit + 1,
        include: { supersededBy: { select: { id: true, publishedAt: true, archivedAt: true } } },
      })
      const rows = await Promise.all(
        documents.map((document) =>
          documentResponse({
            ...document,
            legalHoldReason: null,
            // A successor the board has not published yet is not shown, and
            // neither is a link back to a version members cannot see.
            supersededBy:
              document.supersededBy?.publishedAt && !document.supersededBy.archivedAt
                ? document.supersededBy
                : null,
          }),
        ),
      )
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
      return reply.send(nextCursor(reply, await Promise.all(meetings.map(meetingResponse)), limit))
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
      if (meeting.legalHoldAt) return reply.status(409).send({ error: MEETING_HELD })
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
      if (meeting.legalHoldAt) return reply.status(409).send({ error: MEETING_HELD })

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
      if (meeting.legalHoldAt) return reply.status(409).send({ error: MEETING_HELD })
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
      if (meeting.legalHoldAt) return reply.status(409).send({ error: MEETING_HELD })
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
        include: { supersededBy: { select: { id: true } } },
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
      // A new version names the one it replaces. Each version was a
      // separate, manually numbered row before, with nothing saying which
      // bylaws are the current ones.
      let version = parsed.data.version
      if (parsed.data.supersedesId) {
        const previous = await fastify.prisma.governanceDocument.findUnique({
          where: { id: parsed.data.supersedesId },
          select: { type: true, version: true, supersededBy: { select: { id: true } } },
        })
        if (!previous) return reply.status(400).send({ error: 'Superseded document not found' })
        if (previous.type !== parsed.data.type) {
          return reply
            .status(400)
            .send({ error: 'A document can only supersede one of the same type' })
        }
        if (previous.supersededBy) {
          return reply.status(409).send({ error: 'That version has already been superseded' })
        }
        if (version !== undefined && version <= previous.version) {
          return reply
            .status(400)
            .send({ error: 'The version must be higher than the one it supersedes' })
        }
        version ??= previous.version + 1
      }
      const links = await resolveAgendaLinks(fastify.prisma, parsed.data, {
        meetingId: null,
        agendaItemId: null,
      })
      if ('error' in links) return reply.status(400).send({ error: links.error })
      const document = await fastify.prisma.governanceDocument.create({
        data: { ...parsed.data, ...links, version, createdById: request.sessionUser!.id },
      })
      await auditLog(fastify.prisma, {
        action: 'DOCUMENT_CREATE',
        actorId: request.sessionUser!.id,
        targetId: document.id,
        meta: {
          title: document.title,
          type: document.type,
          version: document.version,
          ...(document.supersedesId ? { supersedesId: document.supersedesId } : {}),
        },
      })
      return reply.status(201).send(await documentResponse(document))
    },
  )

  // PATCH /api/admin/governance/documents/:id — archive or restore, and edit
  // the document's own fields. There was no way to take a document back out
  // of the member list, or to fix a typo in a title, without a new version.
  fastify.patch(
    '/api/admin/governance/documents/:id',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(GovernanceDocumentListSchema.element, 'GovernanceDocument'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams
      const parsed = PatchGovernanceDocumentSchema.safeParse(request.body)
      if (!parsed.success)
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })

      const existing = await fastify.prisma.governanceDocument.findUnique({ where: { id } })
      if (!existing) return reply.status(404).send({ error: 'Document not found' })

      const { archived, ...fields } = parsed.data
      if (existing.legalHoldAt && (archived === true || Object.keys(fields).length > 0)) {
        return reply
          .status(409)
          .send({ error: 'The document is under a legal hold and cannot be changed' })
      }
      if ('meetingId' in fields || 'agendaItemId' in fields) {
        const links = await resolveAgendaLinks(fastify.prisma, fields, existing)
        if ('error' in links) return reply.status(400).send({ error: links.error })
        Object.assign(fields, links)
      }
      const changed = (Object.keys(fields) as Array<keyof typeof fields>).filter((key) => {
        const before = existing[key]
        const after = fields[key]
        return before instanceof Date || after instanceof Date
          ? (before as Date | null)?.getTime() !== (after as Date | null)?.getTime()
          : before !== after
      })
      if (changed.length > 0) {
        await fastify.prisma.governanceDocument.update({
          where: { id },
          data: Object.fromEntries(changed.map((key) => [key, fields[key]])),
        })
        await auditLog(fastify.prisma, {
          action: 'DOCUMENT_UPDATE',
          actorId: request.sessionUser!.id,
          targetId: id,
          meta: { title: fields.title ?? existing.title, changed },
        })
      }

      if (archived !== undefined && archived !== (existing.archivedAt !== null)) {
        await fastify.prisma.governanceDocument.update({
          where: { id },
          data: { archivedAt: archived ? new Date() : null },
        })
        await auditLog(fastify.prisma, {
          action: 'DOCUMENT_ARCHIVE',
          actorId: request.sessionUser!.id,
          targetId: id,
          meta: { title: existing.title, archived },
        })
      }
      const document = await fastify.prisma.governanceDocument.findUniqueOrThrow({
        where: { id },
        include: { supersededBy: { select: { id: true } } },
      })
      return reply.send(await documentResponse(document))
    },
  )
}

export default governanceRecordsRoutes
