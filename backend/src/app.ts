import cors from "cors";
import express from "express";
import { authRouter } from "./routes/auth.js";
import { analyzeRouter } from "./routes/analyze.js";
import { analysesRouter } from "./routes/analyses.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });
  app.use(cors());
  app.use(express.json({ limit: "64kb" }));

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
