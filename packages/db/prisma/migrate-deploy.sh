#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Tahti ry <https://tahti.live>
#
# `prisma migrate deploy`, after clearing migrations that failed in a
# database and were then corrected in place (same folder, fixed SQL).
# Prisma refuses to apply anything while a failed row exists; marking it
# rolled back lets deploy run the corrected SQL. `resolve --rolled-back`
# exits non-zero when the migration is applied or absent, which is fine.
set -e

RECOVERED_MIGRATIONS="20261105180000_channel_site_chrome"

for name in $RECOVERED_MIGRATIONS; do
  prisma migrate resolve --rolled-back "$name" >/dev/null 2>&1 || true
done

exec prisma migrate deploy
