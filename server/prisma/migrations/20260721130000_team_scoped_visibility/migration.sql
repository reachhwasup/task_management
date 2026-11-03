-- Visibility is now derived from where a project lives (team-scoped or
-- personal) instead of an explicit flag, so the private column goes away.
ALTER TABLE "Project" DROP COLUMN "private";
