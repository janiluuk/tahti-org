// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Provider-neutral file metadata used by cloud import pickers and workers. */
export interface CloudImportFile {
  id: string
  name: string
  mimeType: string
  /** Decimal byte count as returned by provider APIs. */
  size?: string
}

export interface CloudImportListOptions {
  pageSize?: number
  pageToken?: string
  query?: string
}

export interface CloudImportFilePage {
  files: CloudImportFile[]
  nextPageToken?: string
}

export interface CloudImportDownload {
  file: CloudImportFile
  body: ReadableStream<Uint8Array>
}

/**
 * Compatibility boundary for OAuth-backed cloud storage imports.
 *
 * Provider-specific OAuth and credential persistence remain with the host.
 * Implementations receive a short-lived access token and never own secrets.
 */
export interface CloudImportProvider {
  readonly id: string
  listFiles(accessToken: string, options?: CloudImportListOptions): Promise<CloudImportFilePage>
  getDownloadStream(accessToken: string, fileId: string): Promise<CloudImportDownload>
  revokeToken(token: string): Promise<void>
}
