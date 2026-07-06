import { Router } from "express";
import { z } from "zod";
import { authMiddleware, type AuthenticatedRequest } from "../middleware/authMiddleware.js";
import { defaultAnalysisOptions } from "../services/analyzer.js";
import { getAnalysisJob, getAnalysisJobResult, startAnalysisJob } from "../services/analysisJobs.js";

const analyzeRouter = Router();

const behaviorSchema = z.object({
  testForms: z.boolean().default(defaultAnalysisOptions.behavior.testForms),
  testSearch: z.boolean().default(defaultAnalysisOptions.behavior.testSearch),
  testButtons: z.boolean().default(defaultAnalysisOptions.behavior.testButtons),
  testLinks: z.boolean().default(defaultAnalysisOptions.behavior.testLinks),
  sampleText: z.string().trim().min(1).max(120).default(defaultAnalysisOptions.behavior.sampleText),
  sampleEmail: z.string().trim().email().default(defaultAnalysisOptions.behavior.sampleEmail),
  samplePhone: z.string().trim().min(1).max(40).default(defaultAnalysisOptions.behavior.samplePhone),
  samplePassword: z.string().min(1).max(120).default(defaultAnalysisOptions.behavior.samplePassword),
  sampleUrl: z.string().trim().url().default(defaultAnalysisOptions.behavior.sampleUrl)
});

const analyzeSchema = z.object({
  url: z.string().min(1),
  testSuites: z
    .array(z.enum(["content", "behavior", "security"]))
    .min(1)
    .default(defaultAnalysisOptions.testSuites),
  behavior: behaviorSchema.default(defaultAnalysisOptions.behavior),
  securityChecks: z
    .array(z.enum(["https", "hsts", "csp", "clickjacking", "mixed-content", "insecure-forms", "password-http"]))
    .min(1)
    .default(defaultAnalysisOptions.securityChecks),
  maxPages: z.coerce.number().int().min(1).max(150).default(defaultAnalysisOptions.maxPages),
  maxDepth: z.coerce.number().int().min(0).max(10).default(defaultAnalysisOptions.maxDepth)
});

analyzeRouter.post("/", authMiddleware, async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = analyzeSchema.parse(req.body);
    const progress = startAnalysisJob(req.auth!.userId, body.url, {
      testSuites: body.testSuites,
      behavior: body.behavior,
      securityChecks: body.securityChecks,
      maxPages: body.maxPages,
      maxDepth: body.maxDepth
    });
    res.status(202).json({ job: progress });
  } catch (error) {
    next(error);
  }
});

analyzeRouter.get("/jobs/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const job = getAnalysisJob(req.auth!.userId, String(req.params.id));
  if (!job) {
    res.status(404).json({ message: "Analysis job not found.", code: "JOB_NOT_FOUND" });
    return;
  }

  res.json({ job });
});

analyzeRouter.get("/jobs/:id/result", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const result = getAnalysisJobResult(req.auth!.userId, String(req.params.id));
  if (!result) {
    res.status(404).json({ message: "Analysis result is not ready.", code: "RESULT_NOT_READY" });
    return;
  }

  res.json({ analysis: result });
});

export { analyzeRouter };
