-- CreateTable
CREATE TABLE "QaRunSchedule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "lastRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QaRunSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QaRunSchedule_userId_enabled_nextRunAt_idx" ON "QaRunSchedule"("userId", "enabled", "nextRunAt");

-- CreateIndex
CREATE INDEX "QaRunSchedule_testId_idx" ON "QaRunSchedule"("testId");

-- AddForeignKey
ALTER TABLE "QaRunSchedule" ADD CONSTRAINT "QaRunSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QaRunSchedule" ADD CONSTRAINT "QaRunSchedule_testId_fkey" FOREIGN KEY ("testId") REFERENCES "QaGeneratedTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
