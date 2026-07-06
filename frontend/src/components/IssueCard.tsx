import type { AnalysisIssue } from "../lib/types";

interface IssueCardProps {
  issue: AnalysisIssue;
  onRerunIssue?: (issue: AnalysisIssue) => void;
}

function formatMetaValue(value: string | number | boolean | null): string {
  if (value === null) {
    return "null";
  }

  if (typeof value === "boolean") {
    return value ? "yes" : "no";
  }

  return String(value);
}

function isImageUrl(value: string): boolean {
  return /^https?:\/\/.+\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(value);
}

export function IssueCard({ issue, onRerunIssue }: IssueCardProps) {
  const evidence = issue.meta ? Object.entries(issue.meta).filter(([, value]) => value !== "") : [];
  const imagePreview = issue.meta?.src && typeof issue.meta.src === "string" && isImageUrl(issue.meta.src) ? issue.meta.src : null;
  const linkPreview = issue.meta?.href && typeof issue.meta.href === "string" ? issue.meta.href : null;
  const consolePreview =
    issue.meta?.consoleError && typeof issue.meta.consoleError === "string" ? issue.meta.consoleError : null;
  const screenshot = issue.screenshot;
  const highlightStyle = screenshot
    ? {
        left: `${(screenshot.highlight.x / screenshot.width) * 100}%`,
        top: `${(screenshot.highlight.y / screenshot.height) * 100}%`,
        width: `${(screenshot.highlight.width / screenshot.width) * 100}%`,
        height: `${(screenshot.highlight.height / screenshot.height) * 100}%`
      }
    : undefined;

  return (
    <article className="issue-card">
      <div className="issue-head">
        <span className={`severity severity-${issue.severity}`}>{issue.severity}</span>
        <span className="category-badge">{issue.category}</span>
      </div>
      <h3>{issue.message}</h3>
      <p className="issue-url">{issue.pageUrl}</p>
      <div className="issue-copy">
        <p>{issue.explanation}</p>
        {screenshot ? (
          <div className="issue-preview">
            <span className="eyebrow">Screenshot evidence</span>
            <div className="issue-screenshot-frame">
              <img className="issue-screenshot" src={screenshot.dataUrl} alt={`Screenshot evidence for ${issue.message}`} />
              <span className="issue-screenshot-highlight" style={highlightStyle} aria-hidden="true" />
            </div>
          </div>
        ) : null}
        {imagePreview ? (
          <div className="issue-preview">
            <span className="eyebrow">Element preview</span>
            <img className="issue-image-preview" src={imagePreview} alt="Problem element preview" loading="lazy" />
          </div>
        ) : null}
        {linkPreview ? (
          <div className="issue-preview">
            <span className="eyebrow">Affected target</span>
            <a className="issue-link-preview" href={linkPreview} target="_blank" rel="noreferrer">
              {linkPreview}
            </a>
          </div>
        ) : null}
        {consolePreview ? (
          <div className="issue-preview">
            <span className="eyebrow">Captured error</span>
            <pre className="issue-code-preview">{consolePreview}</pre>
          </div>
        ) : null}
        {evidence.length > 0 ? (
          <dl className="issue-meta">
            {evidence.map(([key, value]) => (
              <div key={key} className="issue-meta-row">
                <dt>{key}</dt>
                <dd>{formatMetaValue(value)}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <div className="recommendation-block">
          <span className="eyebrow">Recommended fix</span>
          <p className="recommendation">{issue.recommendation}</p>
        </div>
        {onRerunIssue ? (
          <div className="actions-row">
            <button className="secondary-button" onClick={() => onRerunIssue(issue)}>
              Rerun this check
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
