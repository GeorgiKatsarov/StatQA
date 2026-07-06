import type { Prisma } from "@prisma/client";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import type { AnalysisOptions, AnalysisProgress, AnalysisResult, Issue, PageResult, Severity } from "../types/index.js";
import { AppError } from "../utils/appError.js";
import { normalizeUrl } from "../utils/normalizeUrl.js";
import { assertSafePublicUrl } from "../utils/urlSafety.js";
import { crawlSite } from "./crawler.js";
import { getHealthLabel, scoreIssues } from "./scorer.js";
import { defaultBehaviorConfig, scrapePage } from "./scraper.js";
import { validatePage } from "./validator.js";

export const defaultAnalysisOptions: AnalysisOptions = {
  testSuites: ["behavior", "security"],
  behavior: defaultBehaviorConfig,
  securityChecks: ["https", "hsts", "csp", "clickjacking", "mixed-content", "insecure-forms", "password-http"],
  maxPages: Math.min(env.MAX_PAGES, 30),
  maxDepth: Math.min(env.MAX_DEPTH, 3)
};

type ProgressReporter = (progress: Partial<AnalysisProgress>) => void;

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(values.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(values[currentIndex]);
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, values.length)) }, () => worker());
  await Promise.all(workers);
  return results;
}

function rankIssue(issue: Issue): number {
  switch (issue.severity) {
    case "critical":
      return 4;
    case "error":
      return 3;
    case "warning":
      return 2;
    case "info":
      return 1;
  }
}

function formatAnalysisError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\u001b\[[0-9;]*m/g, "").slice(0, 500);
}

function makeFailedPageResult(pageUrl: string, error: unknown): PageResult {
  const issue: Issue = {
    id: `${pageUrl}:performance:critical:page-failed-to-load`.replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
    pageUrl,
    category: "performance",
    severity: "critical",
    message: "Page failed to load during analysis",
    explanation: "The analyzer could not load this URL in the browser, so checks for this page could not complete.",
    recommendation: "Verify the URL serves a browser-readable HTML page and does not require unsupported protocol behavior.",
    meta: {
      error: formatAnalysisError(error)
    }
  };

  return {
    url: pageUrl,
    score: 0,
    healthLabel: "Poor",
    issueCount: 1,
    issues: [issue],
    metrics: {
      links: 0,
      buttons: 0,
      inputs: 0,
      images: 0,
      domNodeCount: 0,
      loadTimeMs: 0
    },
    summary: `1 issue found on ${pageUrl}`
  };
}

function consolidateRepeatedIssues(pageResults: PageResult[]): PageResult[] {
  const seenSiteWide = new Set<string>();
  const siteWideSecurityChecks = new Set(["hsts", "csp", "clickjacking"]);

  return pageResults.map((page) => {
    const issues = page.issues.filter((issue) => {
      const securityCheck = issue.meta?.securityCheck;
      if (issue.category !== "security" || typeof securityCheck !== "string" || !siteWideSecurityChecks.has(securityCheck)) {
        return true;
      }

      const key = `${issue.message}:${securityCheck}`;
      if (seenSiteWide.has(key)) {
        return false;
      }

      seenSiteWide.add(key);
      return true;
    });

    if (issues.length === page.issues.length) {
      return page;
    }

    const { score, healthLabel } = scoreIssues(issues);
    return {
      ...page,
      score,
      healthLabel,
      issueCount: issues.length,
      issues,
      summary: `${issues.length} issues found on ${page.url}`
    };
  });
}

export async function analyzeSite(
  url: string,
  userId: string,
  concurrency = 3,
  options: AnalysisOptions = defaultAnalysisOptions,
  reportProgress?: ProgressReporter
): Promise<AnalysisResult> {
  reportProgress?.({ phase: "validating", message: "Validating target URL", percent: 5 });
  const normalizedUrl = normalizeUrl(url);
  assertSafePublicUrl(normalizedUrl);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError("User not found.", 404, "USER_NOT_FOUND");
  }

  reportProgress?.({ phase: "discovering", message: "Discovering crawlable pages", percent: 12 });
  const urls = await crawlSite(
    normalizedUrl,
    (crawlProgress) => {
      reportProgress?.({
        phase: "discovering",
        message: `Discovered ${crawlProgress.discovered} of ${options.maxPages} allowed pages`,
        pagesDiscovered: crawlProgress.discovered,
        totalPages: 0,
        percent: Math.min(24, 12 + Math.round((crawlProgress.discovered / Math.max(options.maxPages, 1)) * 12))
      });
    },
    { maxPages: options.maxPages, maxDepth: options.maxDepth }
  );
  reportProgress?.({
    phase: "scanning",
    message: `Scanning ${urls.length} discovered ${urls.length === 1 ? "page" : "pages"}`,
    percent: 24,
    pagesDiscovered: urls.length,
    totalPages: urls.length
  });
  let scannedPages = 0;
  let pageResults = await mapWithConcurrency(urls, concurrency, async (pageUrl) => {
    let pageResult: PageResult;
    try {
      const scraped = await scrapePage(pageUrl, options.behavior);
      const issues = validatePage(scraped, options);
      const { score, healthLabel } = scoreIssues(issues);

      pageResult = {
        url: pageUrl,
        score,
        healthLabel,
        issueCount: issues.length,
        issues,
        metrics: {
          links: scraped.links.length,
          buttons: scraped.buttons.length,
          inputs: scraped.inputs.length,
          images: scraped.images.length,
          domNodeCount: scraped.domNodeCount,
          loadTimeMs: scraped.loadTimeMs
        },
        summary: `${issues.length} issues found on ${pageUrl}`
      };
    } catch (error) {
      pageResult = makeFailedPageResult(pageUrl, error);
    }

    scannedPages += 1;
    reportProgress?.({
      phase: "scanning",
      message: `Scanned ${scannedPages} of ${urls.length}: ${pageUrl}`,
      pagesScanned: scannedPages,
      pagesDiscovered: urls.length,
      totalPages: urls.length,
      percent: Math.min(88, 24 + Math.round((scannedPages / Math.max(urls.length, 1)) * 60))
    });

    return pageResult;
  });
  pageResults = consolidateRepeatedIssues(pageResults);

  const allIssues = pageResults.flatMap((result) => result.issues);
  reportProgress?.({ phase: "scoring", message: "Scoring findings and building report", percent: 90 });
  const pagesScanned = pageResults.length;
  const averageScore =
    pagesScanned > 0 ? Math.round(pageResults.reduce((sum, result) => sum + result.score, 0) / pagesScanned) : 100;

  const issuesBySeverity: Record<Severity, number> = {
    critical: 0,
    error: 0,
    warning: 0,
    info: 0
  };
  const issuesByCategory: Record<string, number> = {};

  for (const issue of allIssues) {
    issuesBySeverity[issue.severity] += 1;
    issuesByCategory[issue.category] = (issuesByCategory[issue.category] ?? 0) + 1;
  }

  const analysisResult: AnalysisResult = {
    rootUrl: normalizedUrl,
    testSuites: options.testSuites,
    securityChecks: options.securityChecks,
    score: averageScore,
    healthLabel: getHealthLabel(averageScore),
    pagesScanned,
    totals: {
      issuesBySeverity,
      issuesByCategory,
      links: pageResults.reduce((sum, result) => sum + result.metrics.links, 0),
      buttons: pageResults.reduce((sum, result) => sum + result.metrics.buttons, 0),
      inputs: pageResults.reduce((sum, result) => sum + result.metrics.inputs, 0),
      images: pageResults.reduce((sum, result) => sum + result.metrics.images, 0),
      domNodeCount: pageResults.reduce((sum, result) => sum + result.metrics.domNodeCount, 0),
      averageLoadTimeMs:
        pagesScanned > 0
          ? Math.round(pageResults.reduce((sum, result) => sum + result.metrics.loadTimeMs, 0) / pagesScanned)
          : 0
    },
    highlights: [...allIssues].sort((left, right) => rankIssue(right) - rankIssue(left)).slice(0, 3),
    categoryBreakdown: issuesByCategory,
    pageResults,
    createdAt: new Date().toISOString()
  };

  reportProgress?.({ phase: "saving", message: "Saving analysis report", percent: 96 });
  await prisma.$transaction([
    prisma.analysis.create({
      data: {
        userId,
        url: normalizedUrl,
        score: analysisResult.score,
        healthLabel: analysisResult.healthLabel,
        reportJson: analysisResult as unknown as Prisma.InputJsonValue
      }
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        analysesCount: {
          increment: 1
        }
      }
    })
  ]);

  reportProgress?.({ phase: "completed", message: "Analysis complete", percent: 100 });
  return analysisResult;
}
