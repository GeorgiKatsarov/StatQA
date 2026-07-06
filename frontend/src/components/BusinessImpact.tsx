import type { AnalysisResult } from "../lib/types";

interface BusinessImpactProps {
  analysis: AnalysisResult;
}

function getTopCategory(categories: Record<string, number>): string {
  const [topCategory] = Object.entries(categories).sort((left, right) => right[1] - left[1])[0] ?? [];
  return topCategory ?? "none";
}

function getReadinessLabel(analysis: AnalysisResult): string {
  const blockers = analysis.totals.issuesBySeverity.critical + analysis.totals.issuesBySeverity.error;

  if (blockers > 0) {
    return "Needs fixes before launch";
  }

  if (analysis.totals.issuesBySeverity.warning > 0) {
    return "Usable with improvements";
  }

  return "Ready to share";
}

function getNextAction(analysis: AnalysisResult): string {
  const blockers = analysis.totals.issuesBySeverity.critical + analysis.totals.issuesBySeverity.error;
  const topCategory = getTopCategory(analysis.categoryBreakdown);

  if (blockers > 0) {
    return `Resolve ${blockers} high-impact ${blockers === 1 ? "finding" : "findings"} first, starting with ${topCategory}.`;
  }

  if (analysis.totals.issuesBySeverity.warning > 0) {
    return "Clear the warnings, then rerun the scan to confirm the score stays above 90.";
  }

  return "Export the report and schedule periodic checks to catch regressions.";
}

export function BusinessImpact({ analysis }: BusinessImpactProps) {
  const blockers = analysis.totals.issuesBySeverity.critical + analysis.totals.issuesBySeverity.error;
  const riskCount = blockers + analysis.totals.issuesBySeverity.warning;
  const topCategory = getTopCategory(analysis.categoryBreakdown);

  return (
    <section className="panel business-impact">
      <div className="panel-header">
        <p className="eyebrow">Executive summary</p>
        <h2>{getReadinessLabel(analysis)}</h2>
      </div>
      <div className="impact-grid">
        <div className="impact-item">
          <span>Launch blockers</span>
          <strong>{blockers}</strong>
        </div>
        <div className="impact-item">
          <span>Trust risks</span>
          <strong>{riskCount}</strong>
        </div>
        <div className="impact-item">
          <span>Top category</span>
          <strong>{topCategory}</strong>
        </div>
      </div>
      <p className="impact-action">{getNextAction(analysis)}</p>
      {analysis.testSuites?.length ? (
        <p className="impact-suites">Suites run: {analysis.testSuites.join(", ")}</p>
      ) : null}
    </section>
  );
}
