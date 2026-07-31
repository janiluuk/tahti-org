// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { AdminFilesBrowser } from './_admin-files-browser'

export default function AdminFilesPage() {
  return (
    <>
      <h1 className="admin-section-title">Files</h1>
      <p className="admin-help">
        Browse every archive file on the platform. Filter by user, genre, and type, then narrow
        further with search. Save any filter combo as a named preset (overwrite asks for
        confirmation). Preview turns the row into a seekable progress bar.
      </p>
      <AdminFilesBrowser />
    </>
  )
}
