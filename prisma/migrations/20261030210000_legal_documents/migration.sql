-- One versioned, publishable document system for every legal page, not just the Terms and Conditions.
ALTER TABLE "TermsVersion" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'terms';

DROP INDEX "TermsVersion_workspaceId_number_key";
CREATE UNIQUE INDEX "TermsVersion_workspaceId_kind_number_key" ON "TermsVersion"("workspaceId", "kind", "number");

DROP INDEX "TermsVersion_workspaceId_status_idx";
CREATE INDEX "TermsVersion_workspaceId_kind_status_idx" ON "TermsVersion"("workspaceId", "kind", "status");

-- At most one published version per workspace per document.
DROP INDEX terms_one_published;
CREATE UNIQUE INDEX terms_one_published ON "TermsVersion" ("workspaceId", "kind") WHERE "status" = 'published';
