import type { AnalysisIssue } from "../lib/types";
import { IssueCard } from "./IssueCard";

interface IssueListProps {
  issues: AnalysisIssue[];
  activeCategoryLabel: string;
}

export function IssueList({ issues, activeCategoryLabel }: IssueListProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Issues</h2>
        <p>
          {issues.length} findings in <strong>{activeCategoryLabel}</strong>.
        </p>
      </div>
      <div className="issue-list-scroll stack">
        {issues.map((issue, index) => (
          <IssueCard key={`${issue.id}-${index}`} issue={issue} />
        ))}
      </div>
    </section>
  );
}
