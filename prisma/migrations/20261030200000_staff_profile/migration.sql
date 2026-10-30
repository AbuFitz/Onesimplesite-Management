-- Personal profile: job title, optional phone and the person's own email signature.
ALTER TABLE "StaffMembership" ADD COLUMN "jobTitle" TEXT;
ALTER TABLE "StaffMembership" ADD COLUMN "phone" TEXT;
ALTER TABLE "StaffMembership" ADD COLUMN "signature" TEXT;
