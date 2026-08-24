// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Minimal GitHub REST API client — plain fetch, no octokit dependency, no
// local git clone or `gh` CLI. Isolated in its own module so
// open-theme-pull-request.ts's job logic can be unit-tested with this mocked,
// without ever making a real network call in tests.
//
// Requires GITHUB_PR_TOKEN (a PAT or GitHub App installation token with
// contents:write + pull_requests:write on the target repo) — not provisioned
// anywhere yet; this must be added to the worker's environment in ops before
// this job can run for real. Every function throws if it's unset, so a
// missing token fails the job loudly (worker's PROCESSING/ERROR convention)
// rather than silently no-op-ing.

const GITHUB_API = 'https://api.github.com'
const OWNER = 'janiluuk'
const REPO = 'tahti-org'
const DEFAULT_BRANCH = 'main'

function requireToken(): string {
  const token = process.env.GITHUB_PR_TOKEN
  if (!token) throw new Error('GITHUB_PR_TOKEN is not set')
  return token
}

async function githubRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireToken()}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.headers as Record<string, string> | undefined),
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GitHub API ${init?.method ?? 'GET'} ${path} failed: ${res.status} ${body}`)
  }
  return (await res.json()) as T
}

export async function getDefaultBranchSha(): Promise<string> {
  const ref = await githubRequest<{ object: { sha: string } }>(
    `/repos/${OWNER}/${REPO}/git/ref/heads/${DEFAULT_BRANCH}`,
  )
  return ref.object.sha
}

export async function createBranch(branchName: string, fromSha: string): Promise<void> {
  await githubRequest(`/repos/${OWNER}/${REPO}/git/refs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: fromSha }),
  })
}

/** Returns null if the file doesn't exist on that branch yet (e.g. the
 * registry hasn't been created by any prior submission). */
export async function getFileContent(
  path: string,
  branch: string,
): Promise<{ content: string; sha: string } | null> {
  try {
    const file = await githubRequest<{ content: string; sha: string }>(
      `/repos/${OWNER}/${REPO}/contents/${path}?ref=${encodeURIComponent(branch)}`,
    )
    return { content: Buffer.from(file.content, 'base64').toString('utf8'), sha: file.sha }
  } catch {
    return null
  }
}

export async function putFileContent(
  path: string,
  branch: string,
  content: string,
  message: string,
  existingSha: string | null,
): Promise<void> {
  await githubRequest(`/repos/${OWNER}/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: Buffer.from(content, 'utf8').toString('base64'),
      branch,
      ...(existingSha ? { sha: existingSha } : {}),
    }),
  })
}

export async function createPullRequest(
  branchName: string,
  title: string,
  body: string,
): Promise<string> {
  const pr = await githubRequest<{ html_url: string }>(`/repos/${OWNER}/${REPO}/pulls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, body, head: branchName, base: DEFAULT_BRANCH }),
  })
  return pr.html_url
}
