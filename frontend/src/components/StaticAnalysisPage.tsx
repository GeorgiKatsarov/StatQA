import { useMemo, useState } from "react";
import type { AnalysisSummary } from "../lib/api";
import type { AnalysisIssue, AnalysisJob, AnalysisResult, AnalyzeRequest } from "../lib/types";

interface StaticAnalysisPageProps {
  analysis: AnalysisResult | null;
  activeAnalysisId?: string;
  history: AnalysisSummary[];
  loading: boolean;
  activeJob: AnalysisJob | null;
  defaultUrl: string;
  onAnalyze: (payload: AnalyzeRequest) => Promise<void>;
  onSelectHistory: (analysisId: string) => Promise<void>;
}

const SEVERITIES = ["all", "critical", "error", "warning", "info"] as const;
type SeverityFilter = (typeof SEVERITIES)[number];

function scoreLabel(score: number) {
  if (score >= 90) return "Strong";
  if (score >= 75) return "Usable";
  if (score >= 55) return "Needs work";
  return "Risky";
}

function issueAction(issue: AnalysisIssue) {
  const message = `${issue.message} ${issue.explanation} ${issue.recommendation}`.toLowerCase();
  if (message.includes("button") || message.includes("click")) return "Turn this into a manual interaction check or a Playwright locator assertion.";
  if (message.includes("form") || message.includes("input")) return "Add validation, required-field, and invalid-data manual cases before automating submission.";
  if (message.includes("image") || message.includes("alt")) return "Create an accessibility/content test for missing alt text and broken media.";
  if (message.includes("link")) return "Create navigation coverage and include this URL in link-contract checks.";
  if (message.includes("security") || message.includes("header")) return "Escalate as a technical risk and verify headers in CI or backend monitoring.";
  return "Convert this into either a manual regression case or a framework assertion if it is stable and observable.";
}

function groupByCategory(issues: AnalysisIssue[]) {
  return issues.reduce<Record<string, number>>((acc, issue) => {
    acc[issue.category] = (acc[issue.category] ?? 0) + 1;
    return acc;
  }, {});
}

export function StaticAnalysisPage({ analysis, activeAnalysisId, history, loading, activeJob, defaultUrl, onAnalyze, onSelectHistory }: StaticAnalysisPageProps) {
  const [url, setUrl] = useState(defaultUrl || "");
  const [maxPages, setMaxPages] = useState(3);
  const [maxDepth, setMaxDepth] = useState(1);
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [query, setQuery] = useState("");
  const [testForms, setTestForms] = useState(true);
  const [testLinks, setTestLinks] = useState(true);
  const [testButtons, setTestButtons] = useState(true);
  const [testSearch, setTestSearch] = useState(false);

  const issues = useMemo(() => analysis?.pageResults.flatMap((page) => page.issues) ?? [], [analysis]);
  const filteredIssues = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return issues.filter((issue) => {
      const severityMatch = severity === "all" || issue.severity === severity;
      const textMatch = !normalized || [issue.category, issue.severity, issue.pageUrl, issue.message, issue.explanation, issue.recommendation]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
      return severityMatch && textMatch;
    });
  }, [issues, query, severity]);
  const categoryCounts = useMemo(() => groupByCategory(issues), [issues]);
  const topActions = useMemo(() => filteredIssues.slice(0, 5), [filteredIssues]);

  function runAnalysis() {
    const payload: AnalyzeRequest = {
      url,
      testSuites: ["site-health", "content", "accessibility", "navigation"],
      maxPages,
      maxDepth,
      behavior: {
        testForms,
        testSearch,
        testButtons,
        testLinks,
        sampleText: "StatQA sample text",
        sampleEmail: "qa-user@example.test",
        samplePhone: "+359888000000",
        samplePassword: "SafeTestPassword123!",
        sampleUrl: "https://example.test"
      },
      securityChecks: ["headers", "mixed-content", "forms", "links"]
    };
    void onAnalyze(payload);
  }

  return (
    <section className="panel qa-panel static-analysis-page">
      <div className="panel-header page-intro">
        <p className="eyebrow">Useful static analysis</p>
        <h2>Site health scan that feeds test design</h2>
        <p>
          Use this before manual or automation generation when you want a quick risk map: broken pages, weak content signals, risky forms, navigation issues, accessibility gaps, and security-header warnings.
        </p>
      </div>

      <section className="subpanel">
        <div className="subpanel-heading">
          <h3>Run a focused scan</h3>
          <p>Keep it small and actionable. Static analysis should find risks, not pretend to be full QA.</p>
        </div>
        <div className="qa-form-grid">
          <label className="qa-field-wide">
            Target URL
            <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://your-app.com" />
          </label>
          <label className="qa-field-short">
            Max pages
            <input type="number" min="1" max="10" value={maxPages} onChange={(event) => setMaxPages(Number(event.target.value))} />
          </label>
          <label className="qa-field-short">
            Depth
            <input type="number" min="0" max="3" value={maxDepth} onChange={(event) => setMaxDepth(Number(event.target.value))} />
          </label>
        </div>
        <div className="qa-filter-row framework-options-row">
          <label className="suite-toggle"><input type="checkbox" checked={testForms} onChange={(event) => setTestForms(event.target.checked)} /> Forms</label>
          <label className="suite-toggle"><input type="checkbox" checked={testLinks} onChange={(event) => setTestLinks(event.target.checked)} /> Links</label>
          <label className="suite-toggle"><input type="checkbox" checked={testButtons} onChange={(event) => setTestButtons(event.target.checked)} /> Buttons</label>
          <label className="suite-toggle"><input type="checkbox" checked={testSearch} onChange={(event) => setTestSearch(event.target.checked)} /> Search</label>
        </div>
        <div className="actions-row">
          <button className="primary-button" type="button" disabled={loading || !url.trim()} onClick={runAnalysis}>
            {loading ? "Scanning..." : "Run useful static scan"}
          </button>
          <span className="qa-help-text">Use results to create manual tests or decide what the generated framework should cover.</span>
        </div>
      </section>

      {activeJob && activeJob.status !== "completed" ? (
        <section className="subpanel">
          <div className="subpanel-heading">
            <h3>{activeJob.phase}</h3>
            <p>{activeJob.message}</p>
          </div>
          <div className="test-summary-grid">
            <div><span>Progress</span><strong>{activeJob.percent}%</strong></div>
            <div><span>Pages discovered</span><strong>{activeJob.pagesDiscovered}</strong></div>
            <div><span>Pages scanned</span><strong>{activeJob.pagesScanned}</strong></div>
          </div>
        </section>
      ) : null}

      {analysis ? (
        <>
          <div className="test-summary-grid">
            <div><span>Score</span><strong>{analysis.score}</strong></div>
            <div><span>Health</span><strong>{analysis.healthLabel || scoreLabel(analysis.score)}</strong></div>
            <div><span>Pages</span><strong>{analysis.pagesScanned}</strong></div>
            <div><span>Issues</span><strong>{issues.length}</strong></div>
            <div><span>Links</span><strong>{analysis.totals.links}</strong></div>
            <div><span>Inputs</span><strong>{analysis.totals.inputs}</strong></div>
          </div>

          <section className="subpanel">
            <div className="subpanel-heading">
              <h3>What to do next</h3>
              <p>These are the most useful findings to convert into manual tests, framework assertions, or engineering tickets.</p>
            </div>
            <div className="qa-list compact-framework-list">
              {topActions.map((issue) => (
                <article className="test-row" key={issue.id}>
                  <strong>{issue.message}</strong>
                  <span>{issue.severity} - {issue.category} - {issue.pageUrl}</span>
                  <p>{issue.recommendation}</p>
                  <p><strong>Suggested QA action:</strong> {issueAction(issue)}</p>
                </article>
              ))}
              {!topActions.length ? <div className="empty-state qa-empty-state">No findings match the current filter.</div> : null}
            </div>
          </section>

          <section className="subpanel">
            <div className="subpanel-heading">
              <h3>Findings grid</h3>
              <p>Filter by severity or text, then turn the useful findings into manual tests.</p>
            </div>
            <div className="qa-filter-row">
              <label>
                Severity
                <select value={severity} onChange={(event) => setSeverity(event.target.value as SeverityFilter)}>
                  {SEVERITIES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label>
                Search findings
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="button, form, security, accessibility..." />
              </label>
            </div>
            <div className="qa-table-wrap">
              <table className="qa-test-table">
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Category</th>
                    <th>Finding</th>
                    <th>Page</th>
                    <th>Recommended action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIssues.map((issue) => (
                    <tr key={issue.id}>
                      <td>{issue.severity}</td>
                      <td>{issue.category}</td>
                      <td>{issue.message}</td>
                      <td>{issue.pageUrl}</td>
                      <td>{issueAction(issue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="subpanel">
            <div className="subpanel-heading">
              <h3>Page health</h3>
              <p>Use weak pages as candidates for smoke, navigation, and content-contract tests.</p>
            </div>
            <div className="qa-list compact-framework-list">
              {analysis.pageResults.map((page) => (
                <article className="test-row" key={page.url}>
                  <strong>{page.healthLabel} - {page.score}</strong>
                  <span>{page.issueCount} issues - {page.url}</span>
                </article>
              ))}
            </div>
          </section>

          <details className="settings-section">
            <summary>Category breakdown and scan history</summary>
            <div className="test-summary-grid">
              {Object.entries(categoryCounts).map(([category, count]) => (
                <div key={category}><span>{category}</span><strong>{count}</strong></div>
              ))}
            </div>
            <div className="qa-list compact-framework-list">
              {history.map((item) => (
                <button key={item.id} className={item.id === activeAnalysisId ? "sidebar-item active" : "sidebar-item"} type="button" onClick={() => void onSelectHistory(item.id)}>
                  <span>{item.rootUrl}</span>
                  <small>{item.score} - {new Date(item.createdAt).toLocaleString()}</small>
                </button>
              ))}
            </div>
          </details>
        </>
      ) : (
        <div className="empty-state qa-empty-state">Run a scan to see actionable findings instead of generic static-analysis noise.</div>
      )}
    </section>
  );
}
