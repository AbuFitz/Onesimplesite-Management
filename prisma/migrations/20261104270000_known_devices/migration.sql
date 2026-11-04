CREATE TABLE "known_device" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceHash" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "known_device_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "known_device_userId_deviceHash_key" ON "known_device"("userId", "deviceHash");
CREATE INDEX "known_device_userId_idx" ON "known_device"("userId");

ALTER TABLE "known_device" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'oss_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "known_device" TO oss_app;
    CREATE POLICY oss_app_all ON "known_device" FOR ALL TO oss_app USING (true) WITH CHECK (true);
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON "known_device" FROM anon; END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON "known_device" FROM authenticated; END IF;
END $$;
