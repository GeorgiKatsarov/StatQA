import { useEffect, useMemo, useState } from "react";
import { Highlights } from "../components/Highlights";
import { HistoryList } from "../components/HistoryList";
import { IssueList } from "../components/IssueList";
import { Loader } from "../components/Loader";
import { MetricsPanel } from "../components/MetricsPanel";
import { PageBreakdown } from "../components/PageBreakdown";
import { ReportActions } from "../components/ReportActions";
import { ScoreCard } from "../components/ScoreCard";
import { Sidebar } from "../components/Sidebar";
import { SummaryCards } from "../components/SummaryCards";
import { TopBar } from "../components/TopBar";
import { UrlInput } from "../components/UrlInput";
import type { AnalysisSummary } from "../lib/api";
import type { AnalysisIssue, AnalysisResult, AuthUser } from "../lib/types";

interface DashboardProps {
  analysis: AnalysisResult | null;
  activeAnalysisId?: string;
  history: AnalysisSummary[];
  user: AuthUser;
  loading: boolean;
  error: string;
  onAnalyze: (url: string) => Promise<void>;
  onSelectHistory: (analysisId: string) => Promise<void>;
  onLogout: () => void;
}

export function Dashboard({
  analysis,
  activeAnalysisId,
  history,
  user,
  loading,
  error,
  onAnalyze,
  onSelectHistory,
  onLogout
}: DashboardProps) {
  const [url, setUrl] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const allIssues = useMemo<AnalysisIssue[]>(
    () => analysis?.pageResults.flatMap((page) => page.issues) ?? [],
    [analysis]
  );
  const categories = useMemo<string[]>(
    () => ["all", ...Array.from(new Set(allIssues.map((issue) => issue.category)))],
    [allIssues]
  );

  useEffect(() => {
    setActiveCategory("all");
  }, [analysis?.createdAt]);

  const filteredIssues = useMemo(() => {
    if (activeCategory === "all") {
      return allIssues;
    }

    const normalizedCategory = activeCategory.toLowerCase();
    return allIssues.filter((issue) => issue.category.toLowerCase() === normalizedCategory);
  }, [activeCategory, allIssues]);

  const activeCategoryLabel = activeCategory === "all"
    ? "All Issues"
    : activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1);

  async function handleCopySummary() {
    if (!analysis) {
      return;
    }

    const summary = [
      `StatQA summary for ${analysis.rootUrl}`,
      `Score: ${analysis.score} (${analysis.healthLabel})`,
      `Pages scanned: ${analysis.pagesScanned}`,
      `Critical: ${analysis.totals.issuesBySeverity.critical}`,
      `Errors: ${analysis.totals.issuesBySeverity.error}`,
      `Warnings: ${analysis.totals.issuesBySeverity.warning}`
    ].join("\n");

    await navigator.clipboard.writeText(summary);
  }

  function handleExportJson() {
    if (!analysis) {
      return;
    }

    const blob = new Blob([JSON.stringify(analysis, null, 2)], { type: "application/json" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = "statqa-report.json";
    link.click();
    URL.revokeObjectURL(objectUrl);
  }

  const metrics = analysis
    ? [
        { label: "Links", value: analysis.totals.links },
        { label: "Buttons", value: analysis.totals.buttons },
        { label: "Inputs", value: analysis.totals.inputs },
        { label: "Images", value: analysis.totals.images },
        { label: "DOM nodes", value: analysis.totals.domNodeCount },
        { label: "Avg load ms", value: analysis.totals.averageLoadTimeMs }
      ]
    : [];

  return (
    <div className="dashboard-shell">
      <TopBar email={user.email} analysesCount={user.analysesCount} onLogout={onLogout} />
      <main className="dashboard-content">
        <UrlInput value={url} loading={loading} onChange={setUrl} onSubmit={() => onAnalyze(url)} />
        {error ? <p className="error-banner">{error}</p> : null}
        {loading ? <Loader /> : null}
        <HistoryList history={history} activeAnalysisId={activeAnalysisId} onSelect={onSelectHistory} />
        {analysis ? (
          <>
            <section className="dashboard-grid">
              <ScoreCard score={analysis.score} label={analysis.healthLabel} rootUrl={analysis.rootUrl} />
              <SummaryCards
                critical={analysis.totals.issuesBySeverity.critical + analysis.totals.issuesBySeverity.error}
                warnings={analysis.totals.issuesBySeverity.warning}
                passed={Math.max(
                  0,
                  analysis.pagesScanned * 12 -
                    (analysis.totals.issuesBySeverity.critical +
                      analysis.totals.issuesBySeverity.error +
                      analysis.totals.issuesBySeverity.warning)
                )}
                pagesScanned={analysis.pagesScanned}
                averageLoadTimeMs={analysis.totals.averageLoadTimeMs}
              />
            </section>
            <Highlights highlights={analysis.highlights} />
            <section className="content-grid">
              <Sidebar categories={categories} activeCategory={activeCategory} onSelect={setActiveCategory} />
              <IssueList issues={filteredIssues} activeCategoryLabel={activeCategoryLabel} />
            </section>
            <MetricsPanel metrics={metrics} />
            <PageBreakdown pages={analysis.pageResults} />
            <ReportActions onExportJson={handleExportJson} onCopySummary={handleCopySummary} />
          </>
        ) : null}
        {!analysis && !loading ? (
          <section className="panel">
            <div className="panel-header">
              <h2>Ready for analysis</h2>
              <p>Run a scan to see score, highlights, issues, metrics, and page breakdown.</p>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
