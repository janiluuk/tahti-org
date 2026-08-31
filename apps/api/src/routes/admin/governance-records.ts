// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { Prisma } from '@tahti/db'
import {
  CreateGovernanceDocumentSchema,
  CreateGovernanceMeetingSchema,
  GovernanceAttendanceListSchema,
  GovernanceDocumentListSchema,
  GovernanceMeetingListSchema,
  PatchGovernanceMeetingSchema,
  UpsertGovernanceAttendanceSchema,
  openApiResponse,
  openApiResponses,
} from '@tahti/shared'
import { requireBoard, requireMember } from '../../plugins/auth.js'
import { presignedGetUrl } from '../../lib/minio.js'

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

function meetingResponse(meeting: {
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
  eligibleMemberCount: number | null
  quorumRequired: number | null
  createdAt: Date
  updatedAt: Date
  attendance: Array<{ status: string }>
}) {
  const presentCount = meeting.attendance.filter((record) => record.status === 'PRESENT').length
  return {
    ...meeting,
    attendance: undefined,
    attendanceCount: meeting.attendance.length,
    presentCount,
    quorumMet: meeting.quorumRequired === null ? null : presentCount >= meeting.quorumRequired,
  }
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
    async (_request, reply) => {
      const meetings = await fastify.prisma.governanceMeeting.findMany({
        where: { state: { not: 'DRAFT' } },
        orderBy: { scheduledAt: 'desc' },
        take: 100,
        include: { attendance: { select: { status: true } } },
      })
      return reply.send(meetings.map(meetingResponse))
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
    async (_request, reply) => {
      const documents = await fastify.prisma.governanceDocument.findMany({
        where: { publishedAt: { not: null } },
        orderBy: [{ type: 'asc' }, { effectiveAt: 'desc' }, { version: 'desc' }],
        take: 200,
      })
      return reply.send(await Promise.all(documents.map(documentResponse)))
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
    async (_request, reply) => {
      const meetings = await fastify.prisma.governanceMeeting.findMany({
        orderBy: { scheduledAt: 'desc' },
        take: 100,
        include: { attendance: { select: { status: true } } },
      })
      return reply.send(meetings.map(meetingResponse))
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
      return reply.status(201).send({
        ...meeting,
        attendanceCount: 0,
        presentCount: 0,
        quorumMet: body.quorumRequired ? false : null,
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
      const withAttendance = await fastify.prisma.governanceMeeting.findUniqueOrThrow({
        where: { id: updated.id },
        include: { attendance: { select: { status: true } } },
      })
      return reply.send(meetingResponse(withAttendance))
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
      return reply.status(existing ? 200 : 201).send(record)
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
      return reply.status(201).send(await documentResponse(document))
    },
  )
}

export default governanceRecordsRoutes
