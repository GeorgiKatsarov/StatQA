import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import type { AnalysisOptions, AnalysisProgress, AnalysisResult } from "../types/index.js";
import { analyzeSite } from "./analyzer.js";

interface AnalysisJob {
  userId: string;
  progress: AnalysisProgress;
  result?: AnalysisResult;
}

const jobs = new Map<string, AnalysisJob>();

function nowIso(): string {
  return new Date().toISOString();
}

function updateJob(jobId: string, patch: Partial<AnalysisProgress>): void {
  const job = jobs.get(jobId);
  if (!job) {
    return;
  }

  job.progress = {
    ...job.progress,
    ...patch,
    updatedAt: nowIso()
  };
}

export function startAnalysisJob(userId: string, targetUrl: string, options: AnalysisOptions): AnalysisProgress {
  const jobId = randomUUID();
  const timestamp = nowIso();
  const progress: AnalysisProgress = {
    jobId,
    status: "queued",
    phase: "queued",
    message: "Analysis queued",
    targetUrl,
    percent: 1,
    pagesDiscovered: 0,
    pagesScanned: 0,
    totalPages: 0,
    startedAt: timestamp,
    updatedAt: timestamp
  };

  jobs.set(jobId, { userId, progress });

  void analyzeSite(targetUrl, userId, env.ANALYSIS_CONCURRENCY, options, (patch) => {
    updateJob(jobId, {
      status: patch.phase === "completed" ? "completed" : "running",
      ...patch
    });
  })
    .then((result) => {
      const job = jobs.get(jobId);
      if (job) {
        job.result = result;
      }
      updateJob(jobId, {
        status: "completed",
        phase: "completed",
        message: "Analysis complete",
        percent: 100,
        completedAt: nowIso()
      });
    })
    .catch((error: unknown) => {
      updateJob(jobId, {
        status: "failed",
        phase: "failed",
        message: "Analysis failed",
        percent: 100,
        completedAt: nowIso(),
        error: error instanceof Error ? error.message : "Unknown analysis error"
      });
    });

  return progress;
}

export function getAnalysisJob(userId: string, jobId: string): AnalysisProgress | undefined {
  const job = jobs.get(jobId);
  if (!job || job.userId !== userId) {
    return undefined;
  }

  return job.progress;
}

export function getAnalysisJobResult(userId: string, jobId: string): AnalysisResult | undefined {
  const job = jobs.get(jobId);
  if (!job || job.userId !== userId || job.progress.status !== "completed") {
    return undefined;
  }

  return job.result;
}
