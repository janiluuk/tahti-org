// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  TotpConfirmResponseSchema,
  TotpConfirmSchema,
  TotpDisableSchema,
  TotpSetupResponseSchema,
  TotpStatusResponseSchema,
  openApiResponse,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { hashPassword, verifyPassword } from '../../lib/password.js'
import { generateTotpSecret, totpUri, verifyTotpCode } from '../../lib/totp.js'
import { encryptTotpSecret, decryptTotpSecret } from '../../lib/totp-secret-enc.js'
import { generateBackupCodes } from '../../lib/totp-backup-codes.js'

function zodError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  err: { issues: Array<{ message?: string }> },
) {
  return reply.status(400).send({ error: err.issues[0]?.message ?? 'Invalid request body' })
}

const meTotpRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/totp/status
  fastify.get(
    '/api/me/totp/status',
    {
      preHandler: requireAuth,
      schema: { tags: ['auth'], response: openApiResponse(TotpStatusResponseSchema, 'TotpStatus') },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      return reply.send({ enabled: !!user.totpEnabledAt })
    },
  )

  // POST /api/me/totp/setup — generates a new (unconfirmed) secret and returns it for QR/manual entry.
  // Not enabled until /confirm succeeds with a valid code from it.
  fastify.post(
    '/api/me/totp/setup',
    {
      preHandler: requireAuth,
      schema: { tags: ['auth'], response: openApiResponse(TotpSetupResponseSchema, 'TotpSetup') },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const secret = generateTotpSecret()

      await fastify.prisma.user.update({
        where: { id: user.id },
        data: { totpSecretEnc: encryptTotpSecret(secret), totpEnabledAt: null },
      })

      return reply.send({ secret, otpauthUri: totpUri(secret, user.email) })
    },
  )

  // POST /api/me/totp/confirm { code } — verifies the pending secret and turns 2FA on.
  fastify.post(
    '/api/me/totp/confirm',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['auth'],
        response: openApiResponse(TotpConfirmResponseSchema, 'TotpConfirm'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = TotpConfirmSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const fresh = await fastify.prisma.user.findUnique({
        where: { id: user.id },
        select: { totpSecretEnc: true },
      })
      if (!fresh?.totpSecretEnc) {
        return reply.status(400).send({ error: 'Run setup first' })
      }

      const secret = decryptTotpSecret(fresh.totpSecretEnc)
      if (!verifyTotpCode(secret, parsed.data.code)) {
        return reply.status(400).send({ error: 'Invalid code' })
      }

      // Replace any previous backup codes with a fresh set on every (re-)confirm.
      const backupCodes = generateBackupCodes()
      const codeHashes = await Promise.all(backupCodes.map((code) => hashPassword(code)))

      await fastify.prisma.$transaction([
        fastify.prisma.totpBackupCode.deleteMany({ where: { userId: user.id } }),
        fastify.prisma.user.update({
          where: { id: user.id },
          data: { totpEnabledAt: new Date() },
        }),
        ...codeHashes.map((codeHash) =>
          fastify.prisma.totpBackupCode.create({ data: { userId: user.id, codeHash } }),
        ),
      ])

      return reply.send({ backupCodes })
    },
  )

  // POST /api/me/totp/disable { password }
  fastify.post(
    '/api/me/totp/disable',
    { preHandler: requireAuth, schema: { tags: ['auth'] } },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = TotpDisableSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      if (!user.passwordHash || !(await verifyPassword(user.passwordHash, parsed.data.password))) {
        return reply.status(401).send({ error: 'Incorrect password' })
      }

      await fastify.prisma.$transaction([
        fastify.prisma.totpBackupCode.deleteMany({ where: { userId: user.id } }),
        fastify.prisma.totpChallenge.deleteMany({ where: { userId: user.id } }),
        fastify.prisma.user.update({
          where: { id: user.id },
          data: { totpSecretEnc: null, totpEnabledAt: null },
        }),
      ])

      return reply.status(204).send()
    },
  )
}

export default meTotpRoutes
