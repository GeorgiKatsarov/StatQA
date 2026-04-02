import type { Issue, Severity } from "../types/index.js";

const severityPenalty: Record<Severity, number> = {
  critical: 20,
  error: 10,
  warning: 3,
  info: 0
};

export function getHealthLabel(score: number): string {
  if (score >= 90) {
    return "Excellent";
  }

  if (score >= 75) {
    return "Good";
  }

  if (score >= 50) {
    return "Needs Improvement";
  }

  return "Poor";
}

export function scoreIssues(issues: Issue[]): { score: number; healthLabel: string } {
  const penalty = issues.reduce((sum, issue) => sum + severityPenalty[issue.severity], 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));
  return { score, healthLabel: getHealthLabel(score) };
}
