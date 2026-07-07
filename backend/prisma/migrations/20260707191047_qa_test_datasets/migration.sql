-- CreateTable
CREATE TABLE "QaTestDataset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "fields" TEXT[],
    "datasetName" TEXT NOT NULL,
    "records" JSONB NOT NULL,
    "usageNotes" TEXT[],
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QaTestDataset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QaTestDataset_userId_createdAt_idx" ON "QaTestDataset"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "QaTestDataset_userId_targetUrl_idx" ON "QaTestDataset"("userId", "targetUrl");

-- AddForeignKey
ALTER TABLE "QaTestDataset" ADD CONSTRAINT "QaTestDataset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
