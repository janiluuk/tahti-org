-- M21 v1: multitrack editor projects (timeline JSON + optional archive link)
CREATE TABLE "core"."EditorProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "archiveItemId" TEXT,
    "timeline" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditorProject_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EditorProject_userId_updatedAt_idx" ON "core"."EditorProject"("userId", "updatedAt" DESC);

ALTER TABLE "core"."EditorProject" ADD CONSTRAINT "EditorProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
