-- CreateTable
CREATE TABLE "SigningRequest" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "signerName" TEXT NOT NULL,
    "signerEmail" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "contentText" TEXT NOT NULL,
    "contentSha256" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sentById" UUID,
    "declineReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SigningRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureRecord" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "signingRequestId" UUID NOT NULL,
    "signerName" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "signatureImage" BYTEA,
    "consentText" TEXT NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evidence" JSONB NOT NULL,
    "evidenceSha256" TEXT NOT NULL,

    CONSTRAINT "SignatureRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractDocument" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SigningRequest_workspaceId_contractId_idx" ON "SigningRequest"("workspaceId", "contractId");

-- CreateIndex
CREATE UNIQUE INDEX "SignatureRecord_signingRequestId_key" ON "SignatureRecord"("signingRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractDocument_contractId_kind_key" ON "ContractDocument"("contractId", "kind");

-- AddForeignKey
ALTER TABLE "SigningRequest" ADD CONSTRAINT "SigningRequest_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRecord" ADD CONSTRAINT "SignatureRecord_signingRequestId_fkey" FOREIGN KEY ("signingRequestId") REFERENCES "SigningRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractDocument" ADD CONSTRAINT "ContractDocument_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
