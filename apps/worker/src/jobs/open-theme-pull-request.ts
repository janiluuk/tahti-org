// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { prisma } from '@tahti/db'
import {
  createBranch,
  createPullRequest,
  getDefaultBranchSha,
  getFileContent,
  putFileContent,
} from '../lib/github-api.js'

export interface OpenThemePullRequestPayload {
  themeId: string
}

interface RegistryEntry {
  name: string
  file: string
  author?: string
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'theme'
  )
}

export async function processOpenThemePullRequestJob(job: Job): Promise<void> {
  const { themeId } = job.data as OpenThemePullRequestPayload

  const theme = await prisma.theme.findUnique({
    where: { id: themeId },
    include: { user: { select: { username: true, displayName: true } } },
  })
  if (!theme) throw new Error(`Theme not found: ${themeId}`)

  try {
    const slug = slugify(theme.name)
    const themeFilePath = `themes/${slug}.json`
    const registryPath = 'themes/registry.json'
    const branchName = `theme/${slug}-${theme.id.slice(0, 8)}`

    const baseSha = await getDefaultBranchSha()
    await createBranch(branchName, baseSha)

    const registryFile = await getFileContent(registryPath, branchName)
    let registry: RegistryEntry[] = []
    if (registryFile) {
      try {
        const parsed = JSON.parse(registryFile.content)
        if (Array.isArray(parsed)) registry = parsed
      } catch {
        // Corrupt registry on the remote — start fresh rather than fail the
        // whole submission over a file this job doesn't own the format of.
        registry = []
      }
    }
    const entry: RegistryEntry = {
      name: theme.name,
      file: themeFilePath,
      author: theme.user.displayName,
    }
    registry = [...registry.filter((r) => r.file !== themeFilePath), entry]

    const themeContent = JSON.stringify(
      { version: 1, name: theme.name, vars: theme.varsJson, dark: theme.darkJson },
      null,
      2,
    )

    await putFileContent(
      themeFilePath,
      branchName,
      themeContent,
      `Add theme "${theme.name}" by @${theme.user.username}`,
      null,
    )
    await putFileContent(
      registryPath,
      branchName,
      JSON.stringify(registry, null, 2),
      `Register theme "${theme.name}"`,
      registryFile?.sha ?? null,
    )

    const prUrl = await createPullRequest(
      branchName,
      `Add theme: ${theme.name}`,
      [
        `Submitted by @${theme.user.username} via the in-app theme editor, approved by an admin.`,
        '',
        `- Adds \`${themeFilePath}\``,
        `- Registers it in \`${registryPath}\``,
        '',
        'Merging this PR publishes the theme to the public gallery — nothing else to do.',
      ].join('\n'),
    )

    await prisma.theme.update({
      where: { id: themeId },
      data: { prStatus: 'OPENED', prUrl },
    })
  } catch (err) {
    await prisma.theme.update({ where: { id: themeId }, data: { prStatus: 'ERROR' } })
    throw err
  }
}
