import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authMiddleware, type AuthenticatedRequest } from "../middleware/authMiddleware.js";
import {
  createQaSchedule,
  generateQaTestData,
  generateQaTests,
  getQaAiStatus,
  getQaReportSummary,
  listQaProjects,
  listQaTestDatasets,
  listQaSchedules,
  normalizeQaProjectName,
  refreshQaRun,
  runDueQaSchedules,
  runQaTest,
  toggleQaSchedule
} from "../services/qa.js";
import { buildFrameworkPackage, runFrameworkTests } from "../services/qaFramework.js";

const qaRouter = Router();

const generateTestsSchema = z.object({
  targetUrl: z.string().trim().url(),
  riskContext: z.string().trim().min(3).max(1200),
  pageContext: z.string().trim().max(3000).optional(),
  projectName: z.string().trim().min(1).max(80).optional(),
  count: z.coerce.number().int().min(1).max(100).default(4)
});

const generateDataSchema = z.object({
  targetUrl: z.string().trim().url(),
  scenario: z.string().trim().min(3).max(500),
  fields: z.array(z.string().trim().min(1).max(80)).min(1).max(16),
  projectName: z.string().trim().min(1).max(80).optional(),
  count: z.coerce.number().int().min(1).max(12).default(5)
});

const bulkTestsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200)
});

const bulkArchiveSchema = bulkTestsSchema.extend({
  archived: z.boolean().default(true)
});

const createScheduleSchema = z.object({
  testId: z.string().min(1),
  frequency: z.enum(["daily", "weekly", "monthly"]).default("weekly")
});

const toggleScheduleSchema = z.object({
  enabled: z.boolean()
});

const frameworkBuilderSchema = z.object({
  applicationName: z.string().trim().min(3).max(100),
  applicationUrl: z.string().trim().url(),
  productDescription: z.string().trim().min(40).max(1600),
  mainRoles: z.array(z.string().trim().min(2).max(80)).min(1).max(12),
  criticalFlows: z.array(z.string().trim().min(5).max(160)).min(2).max(30),
  businessRules: z.array(z.string().trim().min(5).max(260)).min(1).max(40),
  riskAreas: z.array(z.string().trim().min(3).max(140)).min(2).max(30),
  supportedBrowsers: z.array(z.enum(["chromium", "firefox", "webkit"])).min(1).max(3),
  includeCi: z.boolean().optional(),
  portfolioMode: z.boolean().optional(),
  confidentialTestAccounts: z.string().trim().max(4000).optional()
});

function projectNameFromQuery(req: AuthenticatedRequest) {
  return typeof req.query.projectName === "string" ? normalizeQaProjectName(req.query.projectName) : undefined;
}

qaRouter.get("/ai/status", authMiddleware, (_req, res) => {
  res.json(getQaAiStatus());
});

qaRouter.post("/framework/generate", authMiddleware, async (req, res, next) => {
  try {
    const body = frameworkBuilderSchema.parse(req.body);
    const framework = await buildFrameworkPackage(body);
    res.status(201).json({ framework });
  } catch (error) {
    next(error);
  }
});

qaRouter.post("/framework/run", authMiddleware, async (req, res, next) => {
  try {
    const body = frameworkBuilderSchema.parse(req.body);
    const result = await runFrameworkTests(body);
    res.status(202).json(result);
  } catch (error) {
    next(error);
  }
});

qaRouter.get("/projects", authMiddleware, async (req: AuthenticatedRequest, res, next) => {
  try {
    const projects = await listQaProjects(req.auth!.userId);
    res.json({ projects });
  } catch (error) {
    next(error);
  }
});

qaRouter.get("/tests", authMiddleware, async (req: AuthenticatedRequest, res, next) => {
  try {
    const status = req.query.status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE";
    const projectName = projectNameFromQuery(req);
    const tests = await prisma.qaGeneratedTest.findMany({
      where: { userId: req.auth!.userId, status, ...(projectName ? { projectName } : {}) },
      orderBy: { createdAt: "desc" },
      include: {
        runs: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });
    res.json({ tests });
  } catch (error) {
    next(error);
  }
});

qaRouter.post("/tests/generate", authMiddleware, async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = generateTestsSchema.parse(req.body);
    const result = await generateQaTests(req.auth!.userId, body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

qaRouter.patch("/tests/:id/archive", authMiddleware, async (req: AuthenticatedRequest, res, next) => {
  try {
    const archived = Boolean(req.body?.archived ?? true);
    const existing = await prisma.qaGeneratedTest.findFirst({
      where: { id: String(req.params.id), userId: req.auth!.userId }
    });
    if (!existing) {
      res.status(404).json({ message: "Generated test not found.", code: "QA_TEST_NOT_FOUND" });
      return;
    }

    const test = await prisma.qaGeneratedTest.update({
      where: { id: existing.id },
      data: {
        status: archived ? "ARCHIVED" : "ACTIVE",
        archivedAt: archived ? new Date() : null
      }
    });
    res.json({ test });
  } catch (error) {
    next(error);
  }
});

qaRouter.post("/tests/bulk/archive", authMiddleware, async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = bulkArchiveSchema.parse(req.body);
    const result = await prisma.qaGeneratedTest.updateMany({
      where: {
        userId: req.auth!.userId,
        id: { in: body.ids }
      },
      data: {
        status: body.archived ? "ARCHIVED" : "ACTIVE",
        archivedAt: body.archived ? new Date() : null
      }
    });
    res.json({ updated: result.count });
  } catch (error) {
    next(error);
  }
});

qaRouter.delete("/tests/bulk", authMiddleware, async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = bulkTestsSchema.parse(req.body);
    const result = await prisma.qaGeneratedTest.deleteMany({
      where: {
        userId: req.auth!.userId,
        id: { in: body.ids }
      }
    });
    res.json({ deleted: result.count });
  } catch (error) {
    next(error);
  }
});

qaRouter.post("/tests/:id/run", authMiddleware, async (req: AuthenticatedRequest, res, next) => {
  try {
    const result = await runQaTest(req.auth!.userId, String(req.params.id));
    if (!result) {
      res.status(404).json({ message: "Generated test not found.", code: "QA_TEST_NOT_FOUND" });
      return;
    }

    res.status(202).json(result);
  } catch (error) {
    next(error);
  }
});

qaRouter.get("/runs", authMiddleware, async (req: AuthenticatedRequest, res, next) => {
  try {
    const projectName = projectNameFromQuery(req);
    const runs = await prisma.qaTestRun.findMany({
      where: { userId: req.auth!.userId, ...(projectName ? { projectName } : {}) },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        test: {
          select: {
            title: true,
            riskArea: true,
            priority: true,
            testType: true
          }
        }
      }
    });
    res.json({ runs });
  } catch (error) {
    next(error);
  }
});

qaRouter.post("/runs/:id/refresh", authMiddleware, async (req: AuthenticatedRequest, res, next) => {
  try {
    const run = await refreshQaRun(req.auth!.userId, String(req.params.id));
    if (!run) {
      res.status(404).json({ message: "QA run not found.", code: "QA_RUN_NOT_FOUND" });
      return;
    }

    res.json({ run });
  } catch (error) {
    next(error);
  }
});

qaRouter.get("/schedules", authMiddleware, async (req: AuthenticatedRequest, res, next) => {
  try {
    const schedules = await listQaSchedules(req.auth!.userId, projectNameFromQuery(req));
    res.json({ schedules });
  } catch (error) {
    next(error);
  }
});

qaRouter.post("/schedules", authMiddleware, async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = createScheduleSchema.parse(req.body);
    const schedule = await createQaSchedule(req.auth!.userId, body);
    if (!schedule) {
      res.status(404).json({ message: "Generated test not found.", code: "QA_TEST_NOT_FOUND" });
      return;
    }

    res.status(201).json({ schedule });
  } catch (error) {
    next(error);
  }
});

qaRouter.patch("/schedules/:id", authMiddleware, async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = toggleScheduleSchema.parse(req.body);
    const schedule = await toggleQaSchedule(req.auth!.userId, String(req.params.id), body.enabled);
    if (!schedule) {
      res.status(404).json({ message: "Schedule not found.", code: "QA_SCHEDULE_NOT_FOUND" });
      return;
    }

    res.json({ schedule });
  } catch (error) {
    next(error);
  }
});

qaRouter.post("/schedules/run-due", authMiddleware, async (req: AuthenticatedRequest, res, next) => {
  try {
    const result = await runDueQaSchedules(req.auth!.userId, projectNameFromQuery(req));
    res.status(202).json(result);
  } catch (error) {
    next(error);
  }
});

qaRouter.post("/test-data/generate", authMiddleware, async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = generateDataSchema.parse(req.body);
    const result = await generateQaTestData(req.auth!.userId, body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

qaRouter.get("/test-data", authMiddleware, async (req: AuthenticatedRequest, res, next) => {
  try {
    const datasets = await listQaTestDatasets(req.auth!.userId, projectNameFromQuery(req));
    res.json({ datasets });
  } catch (error) {
    next(error);
  }
});

qaRouter.get("/reports/summary", authMiddleware, async (req: AuthenticatedRequest, res, next) => {
  try {
    const summary = await getQaReportSummary(req.auth!.userId, projectNameFromQuery(req));
    res.json({ summary });
  } catch (error) {
    next(error);
  }
});

export { qaRouter };
