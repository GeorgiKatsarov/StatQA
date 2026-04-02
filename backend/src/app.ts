import cors from "cors";
import express from "express";
import { authRouter } from "./routes/auth.js";
import { analyzeRouter } from "./routes/analyze.js";
import { analysesRouter } from "./routes/analyses.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/auth", authRouter);
  app.use("/analyze", analyzeRouter);
  app.use("/analyses", analysesRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

