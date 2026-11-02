-- The customer-facing address each team member writes from (abukar@...), separate from their sign-in address.
ALTER TABLE "StaffMembership" ADD COLUMN "aliasEmail" TEXT;
CREATE UNIQUE INDEX "StaffMembership_workspaceId_aliasEmail_key" ON "StaffMembership"("workspaceId", "aliasEmail");
