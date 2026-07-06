import type { AnalysisIssue } from "../lib/types";

interface SecurityPanelProps {
  issues: AnalysisIssue[];
  onRerunIssue?: (issue: AnalysisIssue) => void;
}

export function SecurityPanel({ issues, onRerunIssue }: SecurityPanelProps) {
  const securityIssues = issues.filter((issue) => issue.category === "security");
  const criticalCount = securityIssues.filter((issue) => issue.severity === "critical" || issue.severity === "error").length;

  return (
    <section className="panel">
      <div className="panel-header">
        <p className="eyebrow">Security analysis</p>
        <h2>Vulnerability checks</h2>
        <p>Checks HTTPS, browser security headers, mixed content, insecure forms, and password collection risks.</p>
      </div>
      <div className="test-summary-grid">
        <div>
          <span>Security findings</span>
          <strong>{securityIssues.length}</strong>
        </div>
        <div>
          <span>High-impact risks</span>
          <strong>{criticalCount}</strong>
        </div>
        <div>
          <span>Coverage</span>
          <strong>Headers + DOM</strong>
        </div>
      </div>
      <div className="stack">
        {securityIssues.length > 0 ? (
          securityIssues.map((issue) => (
            <article key={issue.id} className="test-row">
              <div className="issue-head">
                <span className={`severity severity-${issue.severity}`}>{issue.severity}</span>
                <span className="category-badge">{issue.category}</span>
              </div>
              <strong>{issue.message}</strong>
              <span>{issue.pageUrl}</span>
              <p>{issue.explanation}</p>
              <p>{issue.recommendation}</p>
              {onRerunIssue ? (
                <div className="actions-row">
                  <button className="secondary-button" onClick={() => onRerunIssue(issue)}>
                    Rerun this security check
                  </button>
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <p className="empty-state">No security vulnerabilities were detected by the current checks.</p>
        )}
      </div>
    </section>
  );
}
