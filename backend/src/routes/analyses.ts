import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authMiddleware, type AuthenticatedRequest } from "../middleware/authMiddleware.js";

const analysesRouter = Router();

analysesRouter.get("/", authMiddleware, async (req: AuthenticatedRequest, res, next) => {
  try {
    const analyses = await prisma.analysis.findMany({
      where: { userId: req.auth!.userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        url: true,
        score: true,
        healthLabel: true,
        createdAt: true
      }
    });

    res.json({ analyses });
  } catch (error) {
    next(error);
  }
});

analysesRouter.get("/:id", authMiddleware, async (req: AuthenticatedRequest, res, next) => {
  try {
    const analysisId = String(req.params.id);
    const analysis = await prisma.analysis.findFirst({
      where: {
        id: analysisId,
        userId: req.auth!.userId
      }
    });

    if (!analysis) {
      res.status(404).json({ message: "Analysis not found." });
      return;
    }

    res.json({ analysis });
  } catch (error) {
    next(error);
  }
});

export { analysesRouter };
