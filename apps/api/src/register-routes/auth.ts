// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyInstance } from 'fastify'
import registerRoute from '../routes/auth/register.js'
import verifyRoute from '../routes/auth/verify.js'
import usernameAvailableRoute from '../routes/auth/username-available.js'
import setupPasswordRoute from '../routes/auth/setup-password.js'
import resendVerificationRoute from '../routes/auth/resend-verification.js'
import forgotPasswordRoute from '../routes/auth/forgot-password.js'
import resetPasswordRoute from '../routes/auth/reset-password.js'
import loginRoute from '../routes/auth/login.js'
import loginTotpRoute from '../routes/auth/login-totp.js'
import logoutRoute from '../routes/auth/logout.js'
import meRoute from '../routes/auth/me.js'

export async function registerAuthRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(registerRoute)
  await fastify.register(verifyRoute)
  await fastify.register(usernameAvailableRoute)
  await fastify.register(setupPasswordRoute)
  await fastify.register(resendVerificationRoute)
  await fastify.register(forgotPasswordRoute)
  await fastify.register(resetPasswordRoute)
  await fastify.register(loginRoute)
  await fastify.register(loginTotpRoute)
  await fastify.register(logoutRoute)
  await fastify.register(meRoute)
}
