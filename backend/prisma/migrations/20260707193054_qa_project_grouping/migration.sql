-- AlterTable
ALTER TABLE "QaGeneratedTest" ADD COLUMN     "projectName" TEXT NOT NULL DEFAULT 'Default workspace';

-- AlterTable
ALTER TABLE "QaRunSchedule" ADD COLUMN     "projectName" TEXT NOT NULL DEFAULT 'Default workspace';

-- AlterTable
ALTER TABLE "QaTestDataset" ADD COLUMN     "projectName" TEXT NOT NULL DEFAULT 'Default workspace';

-- AlterTable
ALTER TABLE "QaTestRun" ADD COLUMN     "projectName" TEXT NOT NULL DEFAULT 'Default workspace';

-- CreateIndex
CREATE INDEX "QaGeneratedTest_userId_projectName_status_createdAt_idx" ON "QaGeneratedTest"("userId", "projectName", "status", "createdAt");

-- CreateIndex
CREATE INDEX "QaRunSchedule_userId_projectName_enabled_nextRunAt_idx" ON "QaRunSchedule"("userId", "projectName", "enabled", "nextRunAt");

-- CreateIndex
CREATE INDEX "QaTestDataset_userId_projectName_createdAt_idx" ON "QaTestDataset"("userId", "projectName", "createdAt");

-- CreateIndex
CREATE INDEX "QaTestRun_userId_projectName_createdAt_idx" ON "QaTestRun"("userId", "projectName", "createdAt");
