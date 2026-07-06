import type { AnalysisIssue, AnalysisResult } from "../lib/types";

interface BehaviorTestsProps {
  analysis: AnalysisResult;
  issues: AnalysisIssue[];
  onRerunIssue?: (issue: AnalysisIssue) => void;
}

export function BehaviorTests({ analysis, issues, onRerunIssue }: BehaviorTestsProps) {
  const behaviorIssues = issues.filter((issue) => issue.category === "behavior");
  const testedPages = analysis.pageResults.filter((page) => page.issues.some((issue) => issue.category === "behavior"));

  return (
    <section className="panel">
      <div className="panel-header">
        <p className="eyebrow">Separate test suite</p>
        <h2>Behavior checks</h2>
        <p>Forms, search inputs, and safe standalone buttons are tested independently from content checks.</p>
      </div>
      <div className="test-summary-grid">
        <div>
          <span>Pages with behavior findings</span>
          <strong>{testedPages.length}</strong>
        </div>
        <div>
          <span>Failed behavior checks</span>
          <strong>{behaviorIssues.length}</strong>
        </div>
        <div>
          <span>Scan scope</span>
          <strong>{analysis.pagesScanned} pages</strong>
        </div>
      </div>
      <div className="stack">
        {behaviorIssues.length > 0 ? (
          behaviorIssues.map((issue) => (
            <article key={issue.id} className="test-row">
              <strong>{issue.message}</strong>
              <span>{issue.pageUrl}</span>
              <p>{issue.recommendation}</p>
              {onRerunIssue ? (
                <div className="actions-row">
                  <button className="secondary-button" onClick={() => onRerunIssue(issue)}>
                    Rerun this behavior check
                  </button>
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <p className="empty-state">No behavior failures were detected in this report.</p>
        )}
      </div>
    </section>
  );
}
