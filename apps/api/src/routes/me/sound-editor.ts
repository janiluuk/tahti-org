// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import meSoundEditorDraftRoutes from './sound-editor-draft.js'
import meSoundEditorSourceRoutes from './sound-editor-source.js'
import meSoundEditorRenderRoutes from './sound-editor-render.js'
import meSoundEditorPublishRoutes from './sound-editor-publish.js'

const meSoundEditorRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(meSoundEditorDraftRoutes)
  await fastify.register(meSoundEditorSourceRoutes)
  await fastify.register(meSoundEditorRenderRoutes)
  await fastify.register(meSoundEditorPublishRoutes)
}

export default meSoundEditorRoutes
