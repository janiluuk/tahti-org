// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { ChannelVisualPatchSchema, CHANNEL_VISUAL_SELECT } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

const meChannelVisualRoutes: FastifyPluginAsync = async (fastify) => {
  // M31: PLAT-071/073/075 — channel visual preset + color scheme + slideshow preset
  fastify.get('/api/me/channel/visual', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const channel = await fastify.prisma.channel.findUnique({
      where: { userId: user.id },
      select: CHANNEL_VISUAL_SELECT,
    })
    if (!channel) return reply.status(404).send({ error: 'Channel not found' })
    return reply.send(channel)
  })

  fastify.patch('/api/me/channel/visual', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const parsed = ChannelVisualPatchSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
    }
    const {
      visualPreset,
      colorScheme,
      visualSettings,
      headerStyle,
      videoBackgroundUrl,
      brandAccentPreset,
      slideshowPreset,
      slideshowIntervalSeconds,
      slideshowTransitionMs,
      slideshowAutoplay,
      topBarText,
      usePlayerGradient,
      playerColorSchemeJson,
      useBackgroundGradient,
      backgroundColorSchemeJson,
      backgroundVisualPreset,
      nowPlayingOverlayStyle,
      nowPlayingOverlaySettingsJson,
      playerOverlayMode,
      playerOverlayText,
      playerOverlayAlign,
      channelLinks,
    } = parsed.data

    const channel = await fastify.prisma.channel.findUnique({
      where: { userId: user.id },
      select: { id: true, headerStyle: true, playerOverlayMode: true, playerOverlayText: true },
    })
    if (!channel) return reply.status(404).send({ error: 'Channel not found' })

    // Gate on the header style this patch will leave in effect, not just one
    // this specific call happens to set — otherwise a FREE-tier channel that
    // somehow already has VIDEO_LOOP could keep updating its clip URL forever
    // without ever re-tripping the paid-tier check.
    const effectiveHeaderStyle = headerStyle ?? channel.headerStyle
    if (effectiveHeaderStyle === 'VIDEO_LOOP' && user.tier === 'FREE') {
      return reply
        .status(403)
        .send({ error: 'Video loop header is a paid-tier feature — upgrade to use it' })
    }

    const nextPlayerOverlayMode = playerOverlayMode ?? channel.playerOverlayMode
    const nextPlayerOverlayText =
      playerOverlayText !== undefined ? playerOverlayText : channel.playerOverlayText
    if (
      (playerOverlayMode !== undefined || playerOverlayText !== undefined) &&
      nextPlayerOverlayMode !== 'NONE' &&
      nextPlayerOverlayText.trim().length === 0
    ) {
      return reply
        .status(400)
        .send({ error: 'playerOverlayText is required when a player overlay effect is enabled' })
    }

    const updated = await fastify.prisma.channel.update({
      where: { id: channel.id },
      data: {
        ...(visualPreset !== undefined ? { visualPreset } : {}),
        ...(colorScheme !== undefined
          ? { colorSchemeJson: colorScheme ? JSON.stringify(colorScheme) : null }
          : {}),
        ...(visualSettings !== undefined
          ? {
              visualSettingsJson:
                visualSettings && Object.keys(visualSettings).length > 0
                  ? JSON.stringify(visualSettings)
                  : null,
            }
          : {}),
        ...(headerStyle !== undefined ? { headerStyle } : {}),
        ...(videoBackgroundUrl !== undefined
          ? { videoBackgroundUrl: videoBackgroundUrl || null }
          : {}),
        ...(brandAccentPreset !== undefined ? { brandAccentPreset } : {}),
        ...(slideshowPreset !== undefined ? { slideshowPreset } : {}),
        ...(slideshowIntervalSeconds !== undefined ? { slideshowIntervalSeconds } : {}),
        ...(slideshowTransitionMs !== undefined ? { slideshowTransitionMs } : {}),
        ...(slideshowAutoplay !== undefined ? { slideshowAutoplay } : {}),
        ...(topBarText !== undefined ? { topBarText: topBarText || null } : {}),
        ...(usePlayerGradient !== undefined ? { usePlayerGradient } : {}),
        ...(playerColorSchemeJson !== undefined
          ? { playerColorSchemeJson: playerColorSchemeJson || null }
          : {}),
        ...(useBackgroundGradient !== undefined ? { useBackgroundGradient } : {}),
        ...(backgroundColorSchemeJson !== undefined
          ? { backgroundColorSchemeJson: backgroundColorSchemeJson || null }
          : {}),
        ...(backgroundVisualPreset !== undefined
          ? { backgroundVisualPreset: backgroundVisualPreset || null }
          : {}),
        ...(nowPlayingOverlayStyle !== undefined
          ? { nowPlayingOverlayStyle: nowPlayingOverlayStyle || null }
          : {}),
        ...(nowPlayingOverlaySettingsJson !== undefined
          ? { nowPlayingOverlaySettingsJson: nowPlayingOverlaySettingsJson || null }
          : {}),
        ...(playerOverlayMode !== undefined ? { playerOverlayMode } : {}),
        ...(playerOverlayText !== undefined ? { playerOverlayText } : {}),
        ...(playerOverlayAlign !== undefined ? { playerOverlayAlign } : {}),
        ...(channelLinks !== undefined
          ? {
              channelLinksJson:
                channelLinks && channelLinks.length > 0 ? JSON.stringify(channelLinks) : null,
            }
          : {}),
      },
      select: CHANNEL_VISUAL_SELECT,
    })
    return reply.send(updated)
  })
}

export default meChannelVisualRoutes
