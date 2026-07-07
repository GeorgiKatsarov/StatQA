-- CreateEnum
CREATE TYPE "QaTestStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "QaRunStatus" AS ENUM ('PASSED', 'FAILED', 'NEEDS_REVIEW');

-- CreateTable
CREATE TABLE "QaGeneratedTest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "riskArea" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "testType" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "assertions" JSONB NOT NULL,
    "testData" JSONB,
    "sourceContext" TEXT,
    "status" "QaTestStatus" NOT NULL DEFAULT 'ACTIVE',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QaGeneratedTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QaTestRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "status" "QaRunStatus" NOT NULL,
    "summary" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "analysisId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QaTestRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QaGeneratedTest_userId_status_createdAt_idx" ON "QaGeneratedTest"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "QaGeneratedTest_userId_targetUrl_idx" ON "QaGeneratedTest"("userId", "targetUrl");

-- CreateIndex
CREATE INDEX "QaTestRun_userId_createdAt_idx" ON "QaTestRun"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "QaTestRun_testId_createdAt_idx" ON "QaTestRun"("testId", "createdAt");

-- AddForeignKey
ALTER TABLE "QaGeneratedTest" ADD CONSTRAINT "QaGeneratedTest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QaTestRun" ADD CONSTRAINT "QaTestRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QaTestRun" ADD CONSTRAINT "QaTestRun_testId_fkey" FOREIGN KEY ("testId") REFERENCES "QaGeneratedTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
