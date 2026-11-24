-- Team Board: channels on topics and emoji reactions on topics and replies. Additive only.
ALTER TABLE "Note" ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'general';
CREATE INDEX IF NOT EXISTS "Note_workspaceId_channel_idx" ON "Note"("workspaceId", "channel");

CREATE TABLE IF NOT EXISTS "NoteReaction" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "noteId" UUID NOT NULL,
  "targetId" UUID NOT NULL,
  "targetType" TEXT NOT NULL,
  "staffId" UUID NOT NULL,
  "emoji" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NoteReaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NoteReaction_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "NoteReaction_targetId_staffId_emoji_key" ON "NoteReaction"("targetId", "staffId", "emoji");
CREATE INDEX IF NOT EXISTS "NoteReaction_noteId_idx" ON "NoteReaction"("noteId");

ALTER TABLE "NoteReaction" ENABLE ROW LEVEL SECURITY;

-- The app's database role needs access and a policy on every table (RLS is on everywhere). Idempotent, and also covers the referral tables.
DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'oss_app') THEN
    FOREACH t IN ARRAY ARRAY['NoteReaction','Partner','Referral','ReferralLink','RewardEntry'] LOOP
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO oss_app', t);
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = 'oss_app_all') THEN
        EXECUTE format('CREATE POLICY oss_app_all ON public.%I FOR ALL TO oss_app USING (true) WITH CHECK (true)', t);
      END IF;
    END LOOP;
  END IF;
END $$;
