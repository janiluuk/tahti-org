// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function GitHubMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.5 7.5 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  )
}

function ApiDocsMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M5.5 3 2 8l3.5 5M10.5 3 14 8l-3.5 5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Small dev-facing link strip on the homepage — the source repo and the
 * public, unauthenticated Scalar API reference at the API host's apex (see
 * apps/api/src/routes/public-api-docs.ts). Deliberately separate from
 * PublicFooter (shared across every public page) since these two only make
 * sense as a "built in the open" note on the front page. */
export function DevLinks() {
  return (
    <div className="home-dev-links">
      <a
        href="https://github.com/tahtiapp/tahti"
        target="_blank"
        rel="noopener noreferrer"
        className="home-dev-links__item"
      >
        <GitHubMark />
        Source on GitHub
      </a>
      <a href={API_URL} target="_blank" rel="noopener noreferrer" className="home-dev-links__item">
        <ApiDocsMark />
        API documentation
      </a>
    </div>
  )
}
