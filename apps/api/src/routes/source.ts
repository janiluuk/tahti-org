// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// AGPL §13 compliance: every running instance must offer its source code.

import type { FastifyPluginAsync } from 'fastify'
import { openApiRedirectResponse } from '@tahti/shared'
import { config } from '../config.js'

const sourceRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/source',
    {
      schema: {
        tags: ['compliance'],
        description: 'Redirect to AGPL source repository',
        response: openApiRedirectResponse(302),
      },
    },
    async (_request, reply) => {
      return reply.redirect(config.sourceRepoUrl, 302)
    },
  )
}

export default sourceRoute
