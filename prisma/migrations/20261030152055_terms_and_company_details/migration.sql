-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "companyNumber" TEXT,
ADD COLUMN     "vatNumber" TEXT;

-- AlterTable
ALTER TABLE "SigningRequest" ADD COLUMN     "termsVersionId" UUID;

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "companyNumber" TEXT,
ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "registeredAddress" TEXT,
ADD COLUMN     "vatNumber" TEXT;

-- CreateTable
CREATE TABLE "TermsVersion" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Terms and Conditions',
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TermsVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TermsVersion_workspaceId_status_idx" ON "TermsVersion"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TermsVersion_workspaceId_number_key" ON "TermsVersion"("workspaceId", "number");

-- Published terms are immutable; only status (e.g. retire) may change afterwards.
CREATE FUNCTION oss_terms_immutable() RETURNS trigger AS $$
BEGIN
  IF OLD."status" = 'published' AND (NEW."body" <> OLD."body" OR NEW."title" <> OLD."title" OR NEW."number" <> OLD."number") THEN
    RAISE EXCEPTION 'published terms version % is immutable', OLD."number" USING ERRCODE = '23000';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql SET search_path = public, pg_temp;
CREATE TRIGGER terms_immutable BEFORE UPDATE ON "TermsVersion" FOR EACH ROW EXECUTE FUNCTION oss_terms_immutable();
-- At most one published (current) version per workspace.
CREATE UNIQUE INDEX terms_one_published ON "TermsVersion" ("workspaceId") WHERE "status" = 'published';
