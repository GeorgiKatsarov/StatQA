import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import type { AnalysisResult, Issue, PageResult, Severity } from "../types/index.js";
import { AppError } from "../utils/appError.js";
import { normalizeUrl } from "../utils/normalizeUrl.js";
import { assertSafePublicUrl } from "../utils/urlSafety.js";
import { crawlSite } from "./crawler.js";
import { getHealthLabel, scoreIssues } from "./scorer.js";
import { scrapePage } from "./scraper.js";
import { validatePage } from "./validator.js";

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

export async function analyzeSite(url: string, userId: string, concurrency = 3): Promise<AnalysisResult> {
  const normalizedUrl = normalizeUrl(url);
  assertSafePublicUrl(normalizedUrl);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError("User not found.", 404, "USER_NOT_FOUND");
  }

  if (user.analysesCount >= 5) {
    throw new AppError("Free analysis limit reached.", 403, "USAGE_LIMIT_REACHED", {
      analysesCount: user.analysesCount,
      maxAnalyses: 5
    });
  }

  const urls = await crawlSite(normalizedUrl);
  const pageResults = await mapWithConcurrency(urls, concurrency, async (pageUrl) => {
    const scraped = await scrapePage(pageUrl);
    const issues = validatePage(scraped);
    const { score, healthLabel } = scoreIssues(issues);

    const pageResult: PageResult = {
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

    return pageResult;
  });

  const allIssues = pageResults.flatMap((result) => result.issues);
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

  return analysisResult;
}
