-- One live signing request per contract.
CREATE UNIQUE INDEX signing_one_pending ON "SigningRequest" ("contractId") WHERE "status" = 'pending';
-- Signed artefacts and evidence are immutable.
CREATE TRIGGER signature_append_only BEFORE UPDATE OR DELETE ON "SignatureRecord" FOR EACH ROW EXECUTE FUNCTION oss_append_only();
CREATE TRIGGER contract_document_append_only BEFORE UPDATE OR DELETE ON "ContractDocument" FOR EACH ROW EXECUTE FUNCTION oss_append_only();
-- Signing request content cannot change after creation; only status/decline fields may.
CREATE FUNCTION oss_signing_request_frozen() RETURNS trigger AS $$
BEGIN
  IF NEW."contentText" <> OLD."contentText" OR NEW."contentSha256" <> OLD."contentSha256" OR NEW."signerEmail" <> OLD."signerEmail" THEN
    RAISE EXCEPTION 'signing request content is frozen' USING ERRCODE = '23000';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER signing_request_frozen BEFORE UPDATE ON "SigningRequest" FOR EACH ROW EXECUTE FUNCTION oss_signing_request_frozen();
