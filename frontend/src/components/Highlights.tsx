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
            {highlight.screenshot ? (
              <div className="highlight-screenshot-frame">
                <img
                  className="issue-screenshot"
                  src={highlight.screenshot.dataUrl}
                  alt={`Screenshot evidence for ${highlight.message}`}
                />
                <span
                  className="issue-screenshot-highlight"
                  style={{
                    left: `${(highlight.screenshot.highlight.x / highlight.screenshot.width) * 100}%`,
                    top: `${(highlight.screenshot.highlight.y / highlight.screenshot.height) * 100}%`,
                    width: `${(highlight.screenshot.highlight.width / highlight.screenshot.width) * 100}%`,
                    height: `${(highlight.screenshot.highlight.height / highlight.screenshot.height) * 100}%`
                  }}
                  aria-hidden="true"
                />
              </div>
            ) : null}
            <p>{highlight.recommendation}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
