ALTER TABLE "Account" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANUAL', ADD COLUMN "bankImportKey" TEXT, ADD COLUMN "last4" TEXT, ADD COLUMN "balanceAsOf" DATE;
CREATE UNIQUE INDEX "Account_bankImportKey_key" ON "Account"("bankImportKey");
CREATE TABLE "Statement" (
 "id" SERIAL PRIMARY KEY, "accountId" INTEGER NOT NULL REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "period" TEXT NOT NULL, "fingerprint" TEXT NOT NULL, "openingBalance" INTEGER NOT NULL,
 "closingBalance" INTEGER NOT NULL, "filename" TEXT NOT NULL, "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Statement_fingerprint_key" ON "Statement"("fingerprint");
CREATE UNIQUE INDEX "Statement_accountId_period_key" ON "Statement"("accountId", "period");
ALTER TABLE "Transaction" ADD COLUMN "statementId" INTEGER REFERENCES "Statement"("id") ON DELETE RESTRICT ON UPDATE CASCADE, ADD COLUMN "balanceAfter" INTEGER;
