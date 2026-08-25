-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (C) 2026 Tahti ry <https://tahti.live>
-- Support ticket timeline: distinguish a board reply (MESSAGE) from an
-- automatic status-transition record (STATUS_CHANGE) on SupportTicketNote,
-- so the admin UI can render one combined activity trail per ticket.

CREATE TYPE "admin"."SupportTicketNoteKind" AS ENUM ('MESSAGE', 'STATUS_CHANGE');

ALTER TABLE "admin"."SupportTicketNote"
  ADD COLUMN "kind" "admin"."SupportTicketNoteKind" NOT NULL DEFAULT 'MESSAGE';
