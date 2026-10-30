-- Money and quantity invariants
ALTER TABLE "Opportunity"     ADD CONSTRAINT opp_value_nonneg CHECK ("valueMinor" >= 0);
ALTER TABLE "ProposalVersion" ADD CONSTRAINT pv_money_nonneg CHECK ("oneOffMinor" >= 0 AND "recurringMinor" >= 0);
ALTER TABLE "ProposalLine"    ADD CONSTRAINT pl_qty_pos CHECK ("quantity" > 0 AND "unitMinor" >= 0);
ALTER TABLE "Contract"        ADD CONSTRAINT contract_money_nonneg CHECK ("oneOffMinor" >= 0 AND "recurringMinor" >= 0);
ALTER TABLE "BillingIntent"   ADD CONSTRAINT bi_amount_nonneg CHECK ("amountMinor" >= 0);
ALTER TABLE "CalendarEvent"   ADD CONSTRAINT ev_end_after_start CHECK ("endsAt" > "startsAt");

-- Cross-workspace attachment prevention (composite FK via Customer(id, workspaceId))
ALTER TABLE "Contact"     ADD CONSTRAINT contact_ws_fk     FOREIGN KEY ("customerId","workspaceId") REFERENCES "Customer"("id","workspaceId") ON DELETE RESTRICT;
ALTER TABLE "Opportunity" ADD CONSTRAINT opp_ws_fk         FOREIGN KEY ("customerId","workspaceId") REFERENCES "Customer"("id","workspaceId") ON DELETE RESTRICT;
ALTER TABLE "Proposal"    ADD CONSTRAINT proposal_ws_fk    FOREIGN KEY ("customerId","workspaceId") REFERENCES "Customer"("id","workspaceId") ON DELETE RESTRICT;
ALTER TABLE "Contract"    ADD CONSTRAINT contract_ws_fk    FOREIGN KEY ("customerId","workspaceId") REFERENCES "Customer"("id","workspaceId") ON DELETE RESTRICT;
ALTER TABLE "Project"     ADD CONSTRAINT project_ws_fk     FOREIGN KEY ("customerId","workspaceId") REFERENCES "Customer"("id","workspaceId") ON DELETE RESTRICT;

-- Sent proposal versions are immutable (content columns); only supersededAt may change.
CREATE FUNCTION oss_proposal_version_immutable() RETURNS trigger AS $$
BEGIN
  IF OLD."sentAt" IS NOT NULL AND (
       NEW."scope" IS DISTINCT FROM OLD."scope" OR NEW."terms" IS DISTINCT FROM OLD."terms"
    OR NEW."oneOffMinor" <> OLD."oneOffMinor" OR NEW."recurringMinor" <> OLD."recurringMinor"
    OR NEW."currency" <> OLD."currency" OR NEW."sentAt" IS DISTINCT FROM OLD."sentAt"
    OR NEW."validUntil" IS DISTINCT FROM OLD."validUntil") THEN
    RAISE EXCEPTION 'sent proposal version % is immutable', OLD."id" USING ERRCODE = '23000';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER proposal_version_immutable BEFORE UPDATE ON "ProposalVersion"
  FOR EACH ROW EXECUTE FUNCTION oss_proposal_version_immutable();

CREATE FUNCTION oss_proposal_line_immutable() RETURNS trigger AS $$
DECLARE sent timestamptz;
BEGIN
  SELECT "sentAt" INTO sent FROM "ProposalVersion" WHERE "id" = COALESCE(OLD."versionId", NEW."versionId");
  IF sent IS NOT NULL THEN RAISE EXCEPTION 'lines of a sent proposal version are immutable' USING ERRCODE = '23000'; END IF;
  RETURN COALESCE(NEW, OLD);
END $$ LANGUAGE plpgsql;
CREATE TRIGGER proposal_line_immutable BEFORE UPDATE OR DELETE ON "ProposalLine"
  FOR EACH ROW EXECUTE FUNCTION oss_proposal_line_immutable();

-- Append-only audit trail and acceptance evidence
CREATE FUNCTION oss_append_only() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '23000'; END $$ LANGUAGE plpgsql;
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION oss_append_only();
CREATE TRIGGER acceptance_append_only BEFORE UPDATE OR DELETE ON "ProposalAcceptance" FOR EACH ROW EXECUTE FUNCTION oss_append_only();
