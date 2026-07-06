import type { AnalysisIssue } from "../lib/types";

interface RemediationPlanProps {
  issues: AnalysisIssue[];
}

const severityRank: Record<string, number> = {
  critical: 4,
  error: 3,
  warning: 2,
  info: 1
};

function sortIssues(issues: AnalysisIssue[]): AnalysisIssue[] {
  return [...issues].sort((left, right) => {
    const rankDelta = (severityRank[right.severity] ?? 0) - (severityRank[left.severity] ?? 0);
    return rankDelta || left.pageUrl.localeCompare(right.pageUrl);
  });
}

function getPlanGroups(issues: AnalysisIssue[]) {
  const sorted = sortIssues(issues);

  return [
    {
      title: "Fix today",
      description: "Critical and error findings that can block trust, accessibility, or conversion.",
      issues: sorted.filter((issue) => issue.severity === "critical" || issue.severity === "error").slice(0, 5)
    },
    {
      title: "Improve this week",
      description: "Warnings that make the experience feel less reliable or complete.",
      issues: sorted.filter((issue) => issue.severity === "warning").slice(0, 5)
    },
    {
      title: "Monitor",
      description: "Lower-priority findings to track after the main fixes are done.",
      issues: sorted.filter((issue) => issue.severity === "info").slice(0, 5)
    }
  ];
}

export function RemediationPlan({ issues }: RemediationPlanProps) {
  const groups = getPlanGroups(issues);

  return (
    <section className="panel">
      <div className="panel-header">
        <p className="eyebrow">Action plan</p>
        <h2>Prioritized remediation</h2>
      </div>
      <div className="remediation-grid">
        {groups.map((group) => (
          <article key={group.title} className="remediation-column">
            <h3>{group.title}</h3>
            <p>{group.description}</p>
            {group.issues.length > 0 ? (
              <ol className="remediation-list">
                {group.issues.map((issue, index) => (
                  <li key={`${group.title}-${issue.id}-${index}`}>
                    <strong>{issue.message}</strong>
                    <span>{issue.pageUrl}</span>
                    <p>{issue.recommendation}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="empty-state">No findings in this group.</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
