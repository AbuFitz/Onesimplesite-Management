-- A free care period used to start the moment the agreement was signed. It now starts when the site goes live,
-- so any that are running for a project that has not launched yet are put back to waiting for launch.
UPDATE "BillingIntent" b
SET "status" = 'pending', "paidAt" = NULL, "trialEndsAt" = NULL, "cancelsAt" = NULL
WHERE b."kind" = 'recurring_setup' AND b."paidVia" = 'free' AND b."status" = 'active' AND b."requestedAt" IS NULL
  AND EXISTS (SELECT 1 FROM "Project" p WHERE p."contractId" = b."contractId" AND p."stage" <> 'launched');

-- The reminder that was created at signing no longer applies, so remove it. A new one is made at launch.
DELETE FROM "Task" t
WHERE t."doneAt" IS NULL AND t."title" LIKE '%: free care plan ends %. Ask if they want to continue'
  AND NOT EXISTS (SELECT 1 FROM "BillingIntent" b WHERE b."customerId" = t."customerId" AND b."kind" = 'recurring_setup' AND b."paidVia" = 'free' AND b."status" = 'active');
