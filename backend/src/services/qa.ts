import type { Prisma, QaRunSchedule } from "@prisma/client";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { defaultAnalysisOptions } from "./analyzer.js";
import { getAnalysisJob, getAnalysisJobResult, startAnalysisJob } from "./analysisJobs.js";
import { callGroqJson } from "./groq.js";

const MAX_GENERATED_TESTS = 100;
const GROQ_TEST_BATCH_SIZE = 20;
export const DEFAULT_QA_PROJECT_NAME = "Default workspace";

const prioritySchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
  z.enum(["critical", "high", "medium", "low"]).default("medium")
);

const testTypeSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().toLowerCase();
  if (["functional", "e2e", "end-to-end", "ui", "workflow"].includes(normalized)) {
    return "behavior";
  }
  if (["a11y", "accessibility"].includes(normalized)) {
    return "accessibility";
  }
  if (["regression", "smoke"].includes(normalized)) {
    return "regression";
  }
  return normalized;
}, z.enum(["behavior", "security", "content", "accessibility", "regression"]).default("behavior"));

const generatedTestSchema = z.object({
  title: z.string().min(3).max(160),
  riskArea: z.string().min(2).max(80),
  priority: prioritySchema,
  testType: testTypeSchema,
  rationale: z.string().min(8).max(700),
  steps: z.array(z.string().min(2).max(280)).min(1).max(12),
  assertions: z.array(z.string().min(2).max(280)).min(1).max(12),
  testData: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional()
});

const generatedTestsSchema = z.object({
  tests: z.array(z.unknown()).min(1).max(MAX_GENERATED_TESTS)
});

const generatedDataSchema = z.object({
  datasetName: z.string().min(3).max(120),
  records: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))).min(1).max(12),
  usageNotes: z.array(z.string()).default([])
});

type GeneratedQaTest = z.infer<typeof generatedTestSchema>;
type QaRunDetails = {
  jobId?: string;
  trace?: Array<Record<string, unknown>>;
  generatedTest?: Record<string, unknown>;
  initialProgress?: Record<string, unknown>;
  latestProgress?: Record<string, unknown>;
  analysisSummary?: Record<string, unknown>;
};

export interface GenerateTestsInput {
  targetUrl: string;
  riskContext: string;
  pageContext?: string;
  count: number;
  projectName?: string;
}

export interface GenerateTestDataInput {
  targetUrl: string;
  scenario: string;
  fields: string[];
  count: number;
  projectName?: string;
}

export type QaScheduleFrequency = "daily" | "weekly" | "monthly";

export interface CreateQaScheduleInput {
  testId: string;
  frequency: QaScheduleFrequency;
}

export type QaGenerationSource = "groq" | "fallback";

export interface QaGenerationMeta {
  source: QaGenerationSource;
  fallbackReason?: string;
}

export function getQaAiStatus() {
  return {
    groqConfigured: Boolean(env.GROQ_API_KEY?.trim()),
    model: env.GROQ_MODEL
  };
}

export function normalizeQaProjectName(value?: string | null): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 80) : DEFAULT_QA_PROJECT_NAME;
}

function projectFilter(projectName?: string) {
  return projectName ? { projectName: normalizeQaProjectName(projectName) } : {};
}

function formatFallbackReason(error: unknown): string {
  if (error instanceof z.ZodError) {
    return "Groq returned JSON that did not match StatQA's test schema. StatQA used local fallback generation.";
  }

  if (error instanceof Error) {
    if (error.message.includes("GROQ_API_KEY")) {
      return "GROQ_API_KEY is not configured for the running backend. StatQA used local fallback generation.";
    }
    if (error.message.includes("Groq request failed")) {
      return "Groq rejected or failed the request. StatQA used local fallback generation.";
    }
    return error.message.slice(0, 220);
  }

  return "Groq generation failed. StatQA used local fallback generation.";
}

const fallbackScenarios = [
  { title: "Homepage availability", type: "behavior", area: "Core navigation" },
  { title: "Primary navigation links", type: "behavior", area: "Navigation" },
  { title: "Search interaction", type: "behavior", area: "Search" },
  { title: "Signup form validation", type: "behavior", area: "Forms" },
  { title: "Login error handling", type: "behavior", area: "Authentication" },
  { title: "Contact form submission", type: "behavior", area: "Forms" },
  { title: "Newsletter opt-in", type: "behavior", area: "Forms" },
  { title: "Mobile menu behavior", type: "behavior", area: "Responsive navigation" },
  { title: "Broken link sweep", type: "content", area: "Links" },
  { title: "Image alt text review", type: "accessibility", area: "Accessibility" },
  { title: "Heading structure review", type: "accessibility", area: "Accessibility" },
  { title: "HTTPS enforcement", type: "security", area: "Transport security" },
  { title: "Security header review", type: "security", area: "Security headers" },
  { title: "Mixed content detection", type: "security", area: "Security" },
  { title: "Password field safety", type: "security", area: "Authentication" },
  { title: "Metadata quality", type: "content", area: "SEO metadata" },
  { title: "Console error review", type: "regression", area: "Runtime stability" },
  { title: "Slow page warning", type: "regression", area: "Performance" },
  { title: "Button affordance check", type: "behavior", area: "Interaction" },
  { title: "Empty state clarity", type: "content", area: "UX content" }
] as const;

function fallbackTests(input: GenerateTestsInput): GeneratedQaTest[] {
  const count = Math.max(1, Math.min(input.count, MAX_GENERATED_TESTS));
  return Array.from({ length: count }, (_, index) => {
    const scenario = fallbackScenarios[index % fallbackScenarios.length];
    const cycle = Math.floor(index / fallbackScenarios.length) + 1;
    const priority = index % 10 === 0 ? "high" as const : index % 4 === 0 ? "low" as const : "medium" as const;
    return {
      title: `${scenario.title} ${cycle}`,
      riskArea: scenario.area,
      priority,
      testType: scenario.type,
      rationale: `Local fallback test for ${scenario.area.toLowerCase()} based on the provided risk context: ${input.riskContext.slice(0, 180)}.`,
      steps: [
        `Open ${input.targetUrl}`,
        `Focus on ${scenario.area.toLowerCase()} behavior`,
        `Execute the ${scenario.title.toLowerCase()} scenario with representative inputs`,
        "Confirm the page gives clear feedback and remains usable"
      ],
      assertions: [
        `${scenario.title} completes without blocking errors`,
        "No critical console or security issue is introduced",
        "The user-facing result is clear and recoverable"
      ],
      testData: {
        sampleEmail: `qa${index + 1}@example.com`,
        sampleText: `${scenario.title} sample ${cycle}`
      }
    };
  });
}

function normalizeTestSuite(testType: string): Array<"content" | "behavior" | "security"> {
  if (testType === "security") {
    return ["security"];
  }
  if (testType === "content" || testType === "accessibility") {
    return ["content"];
  }
  return ["behavior"];
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

function asRunDetails(value: Prisma.JsonValue): QaRunDetails {
  return value && typeof value === "object" && !Array.isArray(value) ? value as QaRunDetails : {};
}

function deriveRunStatus(issueCounts: { critical: number; error: number; warning: number; info: number }) {
  if (issueCounts.critical > 0 || issueCounts.error > 0) {
    return "FAILED" as const;
  }

  if (issueCounts.warning > 0 || issueCounts.info > 0) {
    return "NEEDS_REVIEW" as const;
  }

  return "PASSED" as const;
}

function appendTrace(details: QaRunDetails, event: Record<string, unknown>): QaRunDetails {
  return {
    ...details,
    trace: [...(Array.isArray(details.trace) ? details.trace : []), event]
  };
}

function addFrequency(date: Date, frequency: QaScheduleFrequency): Date {
  const next = new Date(date);
  if (frequency === "daily") {
    next.setDate(next.getDate() + 1);
  } else if (frequency === "weekly") {
    next.setDate(next.getDate() + 7);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}

async function generateGroqTestBatch(input: GenerateTestsInput, batchNumber: number, batchCount: number, previousTitles: string[]) {
  const response = await callGroqJson([
    {
      role: "system",
      content:
        "You generate concise QA test cases. Return only JSON with a tests array. Each test must include title, riskArea, priority, testType, rationale, steps, assertions, and optional testData. Use lowercase enum values for priority and testType."
    },
    {
      role: "user",
      content: JSON.stringify({
        targetUrl: input.targetUrl,
        riskContext: input.riskContext,
        pageContext: input.pageContext,
        requestedCount: batchCount,
        batchNumber,
        avoidDuplicateTitles: previousTitles
      })
    }
  ]);

  const parsed = generatedTestsSchema.parse(response).tests;
  return parsed.flatMap((candidate) => {
    const result = generatedTestSchema.safeParse(candidate);
    return result.success ? [result.data] : [];
  }).slice(0, batchCount);
}

export async function generateQaTests(userId: string, input: GenerateTestsInput) {
  const requestedCount = Math.max(1, Math.min(input.count, MAX_GENERATED_TESTS));
  const projectName = normalizeQaProjectName(input.projectName);
  let tests: GeneratedQaTest[] = [];
  let meta: QaGenerationMeta = { source: "groq" };

  try {
    const seenTitles = new Set<string>();
    let remaining = requestedCount;
    let batchNumber = 1;

    while (remaining > 0) {
      const batchCount = Math.min(GROQ_TEST_BATCH_SIZE, remaining);
      const batch = await generateGroqTestBatch(input, batchNumber, batchCount, Array.from(seenTitles));
      for (const test of batch) {
        const titleKey = normalizeTitle(test.title);
        if (!seenTitles.has(titleKey)) {
          seenTitles.add(titleKey);
          tests.push(test);
        }
      }

      remaining = requestedCount - tests.length;
      batchNumber += 1;
      if (batch.length === 0 || batchNumber > Math.ceil(requestedCount / GROQ_TEST_BATCH_SIZE) + 2) {
        break;
      }
    }

    if (tests.length === 0) {
      throw new Error("Groq returned no usable tests.");
    }

    if (tests.length < requestedCount) {
      const fillCount = requestedCount - tests.length;
      const filler = fallbackTests({ ...input, count: fillCount });
      tests = [...tests, ...filler];
      meta = {
        source: "fallback",
        fallbackReason: `Groq returned ${tests.length - fillCount} usable tests, so StatQA filled the remaining ${fillCount} tests locally.`
      };
    }
  } catch (error) {
    meta = {
      source: "fallback",
      fallbackReason: formatFallbackReason(error)
    };
    tests = fallbackTests({ ...input, count: requestedCount });
  }

  const created = await prisma.$transaction(
    tests.map((test) =>
      prisma.qaGeneratedTest.create({
        data: {
          userId,
          projectName,
          targetUrl: input.targetUrl,
          title: test.title,
          riskArea: test.riskArea,
          priority: test.priority,
          testType: test.testType,
          rationale: test.rationale,
          steps: test.steps as Prisma.InputJsonValue,
          assertions: test.assertions as Prisma.InputJsonValue,
          testData: (test.testData ?? null) as Prisma.InputJsonValue,
          sourceContext: input.pageContext || input.riskContext
        }
      })
    )
  );

  return {
    tests: created,
    meta
  };
}

export async function generateQaTestData(userId: string, input: GenerateTestDataInput) {
  const projectName = normalizeQaProjectName(input.projectName);
  let result;
  try {
    const response = await callGroqJson([
      {
        role: "system",
        content:
          "You generate realistic but synthetic QA test data. Return JSON with datasetName, records, and usageNotes. Never include real credentials or personal data."
      },
      {
        role: "user",
        content: JSON.stringify(input)
      }
    ]);
    result = {
      dataset: generatedDataSchema.parse(response),
      meta: {
        source: "groq" as const
      }
    };
  } catch (error) {
    const fallbackReason = formatFallbackReason(error);
    const dataset = {
      datasetName: "Local synthetic QA dataset",
      records: Array.from({ length: Math.max(1, Math.min(input.count, 10)) }, (_, index) =>
        Object.fromEntries(
          input.fields.map((field) => [
            field,
            field.toLowerCase().includes("email")
              ? `qa${index + 1}@example.com`
              : field.toLowerCase().includes("url")
                ? input.targetUrl
                : `${input.scenario || "sample"} ${field} ${index + 1}`
          ])
        )
      ),
      usageNotes: [
        env.GROQ_API_KEY
          ? "Groq returned invalid data, so StatQA generated a local fallback dataset."
          : "GROQ_API_KEY is not configured, so StatQA generated a local fallback dataset."
      ]
    };

    result = {
      dataset,
      meta: {
        source: "fallback" as const,
        fallbackReason
      }
    };
  }

  const savedDataset = await prisma.qaTestDataset.create({
    data: {
      userId,
      projectName,
      targetUrl: input.targetUrl,
      scenario: input.scenario,
      fields: input.fields,
      datasetName: result.dataset.datasetName,
      records: result.dataset.records as Prisma.InputJsonValue,
      usageNotes: result.dataset.usageNotes,
      source: result.meta.source
    }
  });

  return {
    ...result,
    savedDataset
  };
}

export async function listQaProjects(userId: string) {
  const [tests, datasets, runs, schedules] = await Promise.all([
    prisma.qaGeneratedTest.findMany({ where: { userId }, distinct: ["projectName"], select: { projectName: true } }),
    prisma.qaTestDataset.findMany({ where: { userId }, distinct: ["projectName"], select: { projectName: true } }),
    prisma.qaTestRun.findMany({ where: { userId }, distinct: ["projectName"], select: { projectName: true } }),
    prisma.qaRunSchedule.findMany({ where: { userId }, distinct: ["projectName"], select: { projectName: true } })
  ]);
  const names = new Set<string>([DEFAULT_QA_PROJECT_NAME]);
  [...tests, ...datasets, ...runs, ...schedules].forEach((item) => {
    names.add(normalizeQaProjectName(item.projectName));
  });
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

export async function runQaTest(userId: string, testId: string) {
  const test = await prisma.qaGeneratedTest.findFirst({
    where: { id: testId, userId }
  });

  if (!test) {
    return null;
  }

  const suites = normalizeTestSuite(test.testType);
  const job = startAnalysisJob(userId, test.targetUrl, {
    ...defaultAnalysisOptions,
    testSuites: suites,
    maxPages: 1,
    maxDepth: 0
  });

  const run = await prisma.qaTestRun.create({
    data: {
      userId,
      testId: test.id,
      projectName: test.projectName,
      targetUrl: test.targetUrl,
      status: "NEEDS_REVIEW",
      summary: `Started ${suites.join(", ")} run for ${test.title}`,
      details: {
        jobId: job.jobId,
        trace: [
          {
            status: "queued",
            message: "Generated test run was queued.",
            at: job.startedAt
          },
          {
            status: job.status,
            phase: job.phase,
            message: job.message,
            percent: job.percent,
            at: job.updatedAt
          }
        ],
        generatedTest: {
          title: test.title,
          steps: test.steps,
          assertions: test.assertions
        },
        initialProgress: {
          status: job.status,
          phase: job.phase,
          message: job.message,
          percent: job.percent,
          pagesDiscovered: job.pagesDiscovered,
          pagesScanned: job.pagesScanned,
          totalPages: job.totalPages
        }
      } as Prisma.InputJsonValue
    }
  });

  return { run, job };
}

export async function refreshQaRun(userId: string, runId: string) {
  const run = await prisma.qaTestRun.findFirst({
    where: { id: runId, userId },
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

  if (!run) {
    return null;
  }

  const details = asRunDetails(run.details as Prisma.JsonValue);
  const jobId = typeof details.jobId === "string" ? details.jobId : undefined;
  if (!jobId) {
    const updated = await prisma.qaTestRun.update({
      where: { id: run.id },
      data: {
        status: "NEEDS_REVIEW",
        summary: "Run cannot be refreshed because no analysis job id was stored.",
        details: appendTrace(details, {
          status: "needs_review",
          message: "Missing analysis job id.",
          at: new Date().toISOString()
        }) as Prisma.InputJsonValue
      }
    });
    return updated;
  }

  const progress = getAnalysisJob(userId, jobId);
  if (!progress) {
    const updated = await prisma.qaTestRun.update({
      where: { id: run.id },
      data: {
        status: "NEEDS_REVIEW",
        summary: "Analysis job is no longer available in memory. Review the latest stored scan manually.",
        details: appendTrace(details, {
          status: "needs_review",
          message: "Analysis job was not found. The backend may have restarted.",
          at: new Date().toISOString()
        }) as Prisma.InputJsonValue
      }
    });
    return updated;
  }

  const progressDetails = appendTrace(
    {
      ...details,
      latestProgress: progress as unknown as Record<string, unknown>
    },
    {
      status: progress.status,
      phase: progress.phase,
      message: progress.message,
      percent: progress.percent,
      at: progress.updatedAt
    }
  );

  if (progress.status !== "completed") {
    const updated = await prisma.qaTestRun.update({
      where: { id: run.id },
      data: {
        status: progress.status === "failed" ? "FAILED" : "NEEDS_REVIEW",
        summary: progress.status === "failed" ? progress.error ?? "Analysis job failed." : progress.message,
        details: progressDetails as Prisma.InputJsonValue
      }
    });
    return updated;
  }

  const result = getAnalysisJobResult(userId, jobId);
  if (!result) {
    const updated = await prisma.qaTestRun.update({
      where: { id: run.id },
      data: {
        status: "NEEDS_REVIEW",
        summary: "Analysis completed, but the result is no longer available. Review the saved scan report.",
        details: appendTrace(progressDetails, {
          status: "needs_review",
          message: "Completed analysis result was unavailable.",
          at: new Date().toISOString()
        }) as Prisma.InputJsonValue
      }
    });
    return updated;
  }

  const issueCounts = result.totals.issuesBySeverity;
  const status = deriveRunStatus(issueCounts);
  const summary =
    status === "PASSED"
      ? `Passed with no findings across ${result.pagesScanned} scanned page(s).`
      : status === "FAILED"
        ? `Failed with ${issueCounts.critical} critical and ${issueCounts.error} error finding(s).`
        : `Needs review with ${issueCounts.warning} warning and ${issueCounts.info} informational finding(s).`;
  const updated = await prisma.qaTestRun.update({
    where: { id: run.id },
    data: {
      status,
      summary,
      details: appendTrace(
        {
          ...progressDetails,
          analysisSummary: {
            score: result.score,
            healthLabel: result.healthLabel,
            pagesScanned: result.pagesScanned,
            issuesBySeverity: issueCounts,
            highlights: result.highlights.slice(0, 5)
          }
        },
        {
          status,
          phase: "completed",
          message: summary,
          percent: 100,
          at: new Date().toISOString()
        }
      ) as Prisma.InputJsonValue
    }
  });

  return updated;
}

export async function getQaReportSummary(userId: string, projectName?: string) {
  const workspaceFilter = projectFilter(projectName);
  const [activeTests, archivedTests, runs, latestTests, schedules] = await Promise.all([
    prisma.qaGeneratedTest.count({ where: { userId, status: "ACTIVE", ...workspaceFilter } }),
    prisma.qaGeneratedTest.count({ where: { userId, status: "ARCHIVED", ...workspaceFilter } }),
    prisma.qaTestRun.findMany({
      where: { userId, ...workspaceFilter },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { test: { select: { title: true, riskArea: true, priority: true } } }
    }),
    prisma.qaGeneratedTest.findMany({
      where: { userId, ...workspaceFilter },
      orderBy: { createdAt: "desc" },
      take: 5
    }),
    prisma.qaRunSchedule.findMany({
      where: { userId, ...workspaceFilter },
      orderBy: { nextRunAt: "asc" },
      take: 10,
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
    })
  ]);

  return {
    activeTests,
    archivedTests,
    totalRuns: runs.length,
    runsByStatus: runs.reduce<Record<string, number>>((totals, run) => {
      totals[run.status] = (totals[run.status] ?? 0) + 1;
      return totals;
    }, {}),
    recentRuns: runs,
    latestTests,
    schedules
  };
}

export async function listQaTestDatasets(userId: string, projectName?: string) {
  return prisma.qaTestDataset.findMany({
    where: { userId, ...projectFilter(projectName) },
    orderBy: { createdAt: "desc" },
    take: 50
  });
}

export async function listQaSchedules(userId: string, projectName?: string) {
  return prisma.qaRunSchedule.findMany({
    where: { userId, ...projectFilter(projectName) },
    orderBy: [{ enabled: "desc" }, { nextRunAt: "asc" }],
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
}

export async function createQaSchedule(userId: string, input: CreateQaScheduleInput) {
  const test = await prisma.qaGeneratedTest.findFirst({
    where: {
      id: input.testId,
      userId,
      status: "ACTIVE"
    }
  });

  if (!test) {
    return null;
  }

  return prisma.qaRunSchedule.create({
    data: {
      userId,
      testId: test.id,
      projectName: test.projectName,
      targetUrl: test.targetUrl,
      frequency: input.frequency,
      nextRunAt: addFrequency(new Date(), input.frequency)
    },
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
}

export async function toggleQaSchedule(userId: string, scheduleId: string, enabled: boolean) {
  const schedule = await prisma.qaRunSchedule.findFirst({
    where: { id: scheduleId, userId }
  });

  if (!schedule) {
    return null;
  }

  return prisma.qaRunSchedule.update({
    where: { id: schedule.id },
    data: { enabled },
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
}

async function runScheduleRecords(schedules: QaRunSchedule[], now: Date) {
  const results = [];
  for (const schedule of schedules) {
    try {
      const result = await runQaTest(schedule.userId, schedule.testId);
      if (!result) {
        continue;
      }

      await prisma.qaRunSchedule.update({
        where: { id: schedule.id },
        data: {
          lastRunAt: now,
          lastRunId: result.run.id,
          nextRunAt: addFrequency(now, schedule.frequency as QaScheduleFrequency)
        }
      });
      results.push(result.run);
    } catch (error) {
      console.error(`Unable to start scheduled QA run ${schedule.id}`, error);
    }
  }

  return results;
}

export async function runDueQaSchedules(userId: string, projectName?: string) {
  const now = new Date();
  const schedules = await prisma.qaRunSchedule.findMany({
    where: {
      userId,
      enabled: true,
      nextRunAt: { lte: now },
      ...projectFilter(projectName)
    },
    orderBy: { nextRunAt: "asc" },
    take: 10
  });

  const results = await runScheduleRecords(schedules, now);

  return {
    scanned: schedules.length,
    started: results.length,
    runs: results
  };
}

export async function runAllDueQaSchedules(limit = 25) {
  const now = new Date();
  const schedules = await prisma.qaRunSchedule.findMany({
    where: {
      enabled: true,
      nextRunAt: { lte: now }
    },
    orderBy: { nextRunAt: "asc" },
    take: limit
  });

  const results = await runScheduleRecords(schedules, now);

  return {
    scanned: schedules.length,
    started: results.length,
    runs: results
  };
}
