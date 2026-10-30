-- AlterTable
ALTER TABLE "ProposalVersion" ADD COLUMN     "requirements" JSONB;

-- Sent versions stay immutable: requirements join the protected content columns.
CREATE OR REPLACE FUNCTION oss_proposal_version_immutable() RETURNS trigger AS $$
BEGIN
  IF OLD."sentAt" IS NOT NULL AND (
       NEW."scope" IS DISTINCT FROM OLD."scope" OR NEW."terms" IS DISTINCT FROM OLD."terms"
    OR NEW."oneOffMinor" <> OLD."oneOffMinor" OR NEW."recurringMinor" <> OLD."recurringMinor"
    OR NEW."currency" <> OLD."currency" OR NEW."sentAt" IS DISTINCT FROM OLD."sentAt"
    OR NEW."validUntil" IS DISTINCT FROM OLD."validUntil"
    OR NEW."requirements" IS DISTINCT FROM OLD."requirements") THEN
    RAISE EXCEPTION 'sent proposal version % is immutable', OLD."id" USING ERRCODE = '23000';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql SET search_path = public, pg_temp;
