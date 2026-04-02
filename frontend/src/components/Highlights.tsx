import type { AnalysisIssue } from "../lib/types";

interface HighlightsProps {
  highlights: AnalysisIssue[];
}

export function Highlights({ highlights }: HighlightsProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Top highlights</h2>
      </div>
      <div className="stack">
        {highlights.map((highlight) => (
          <article key={highlight.id} className="highlight-card">
            <div className="issue-head">
              <span className={`severity severity-${highlight.severity}`}>{highlight.severity}</span>
              <span className="category-badge">{highlight.category}</span>
            </div>
            <h3>{highlight.message}</h3>
            <p className="issue-url">{highlight.pageUrl}</p>
            <p>{highlight.recommendation}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
