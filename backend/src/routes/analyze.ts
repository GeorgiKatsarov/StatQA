import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { authMiddleware, type AuthenticatedRequest } from "../middleware/authMiddleware.js";
import { analyzeSite } from "../services/analyzer.js";

const analyzeRouter = Router();

const analyzeSchema = z.object({
  url: z.string().min(1)
});

analyzeRouter.post("/", authMiddleware, async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = analyzeSchema.parse(req.body);
    const result = await analyzeSite(body.url, req.auth!.userId, env.ANALYSIS_CONCURRENCY);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

export { analyzeRouter };

