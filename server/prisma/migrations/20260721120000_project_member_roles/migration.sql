-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('OWNER', 'EDITOR');

-- AlterTable
ALTER TABLE "ProjectMember" ADD COLUMN "role" "ProjectRole" NOT NULL DEFAULT 'EDITOR';

-- Backfill: the app never stored a project creator, so promote each project's
-- earliest member (the creator was always auto-added first) to OWNER.
UPDATE "ProjectMember" SET "role" = 'OWNER'
WHERE "id" IN (
  SELECT DISTINCT ON ("projectId") "id"
  FROM "ProjectMember"
  ORDER BY "projectId", "createdAt" ASC, "id" ASC
);
