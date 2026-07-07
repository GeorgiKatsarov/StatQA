import { useEffect, useMemo, useState } from "react";
import { AccountProfile } from "../components/AccountProfile";
import { AppSidebar } from "../components/AppSidebar";
import { BehaviorTests } from "../components/BehaviorTests";
import { BusinessImpact } from "../components/BusinessImpact";
import { Highlights } from "../components/Highlights";
import { HistoryList } from "../components/HistoryList";
import { IssueList } from "../components/IssueList";
import { MetricsPanel } from "../components/MetricsPanel";
import { PageBreakdown } from "../components/PageBreakdown";
import { QaWorkspace } from "../components/QaWorkspace";
import { RemediationPlan } from "../components/RemediationPlan";
import { ReportActions } from "../components/ReportActions";
import { ScanProgress, estimateScanSeconds } from "../components/ScanProgress";
import { ScoreCard } from "../components/ScoreCard";
import { SecurityPanel } from "../components/SecurityPanel";
import { Sidebar } from "../components/Sidebar";
import { SummaryCards } from "../components/SummaryCards";
import { TopBar } from "../components/TopBar";
import { BehaviorSetup, SecuritySetup, StaticAnalysisSetup, UrlInput, securityOptions, testSuites } from "../components/UrlInput";
import type { AnalysisSummary } from "../lib/api";
import type { AnalysisIssue, AnalysisJob, AnalysisResult, AnalyzeRequest, AuthUser } from "../lib/types";

interface DashboardProps {
  analysis: AnalysisResult | null;
  activeAnalysisId?: string;
  history: AnalysisSummary[];
  user: AuthUser;
  loading: boolean;
  activeJob: AnalysisJob | null;
  error: string;
  onAnalyze: (payload: AnalyzeRequest) => Promise<void>;
  onSelectHistory: (analysisId: string) => Promise<void>;
  onLogout: () => void;
}

export function Dashboard({
  analysis,
  activeAnalysisId,
  history,
  user,
  loading,
  activeJob,
  error,
  onAnalyze,
  onSelectHistory,
  onLogout
}: DashboardProps) {
  const [url, setUrl] = useState("");
  const [activePage, setActivePage] = useState("scan");
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeView, setActiveView] = useState<"overview" | "pages" | "behavior" | "security" | "issues">("overview");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [selectedSuites, setSelectedSuites] = useState<string[]>(["behavior", "security"]);
  const [maxPages, setMaxPages] = useState(30);
  const [maxDepth, setMaxDepth] = useState(3);
  const [securityChecks, setSecurityChecks] = useState<string[]>([
    "https",
    "hsts",
    "csp",
    "clickjacking",
    "mixed-content",
    "insecure-forms",
    "password-http"
  ]);
  const [behavior, setBehavior] = useState<AnalyzeRequest["behavior"]>({
    testForms: true,
    testSearch: true,
    testButtons: true,
    testLinks: true,
    sampleText: "statqa test",
    sampleEmail: "statqa@example.com",
    samplePhone: "5550100",
    samplePassword: "StatQA-Test-123!",
    sampleUrl: "https://example.com"
  });

  useEffect(() => {
    const savedSettings = localStorage.getItem("statqa_scan_settings");
    if (!savedSettings) {
      setSettingsHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(savedSettings) as Partial<{
        selectedSuites: string[];
        maxPages: number;
        maxDepth: number;
        securityChecks: string[];
        behavior: AnalyzeRequest["behavior"];
      }>;

      if (Array.isArray(parsed.selectedSuites) && parsed.selectedSuites.length > 0) {
        setSelectedSuites(parsed.selectedSuites);
      }
      if (typeof parsed.maxPages === "number") {
        setMaxPages(parsed.maxPages);
      }
      if (typeof parsed.maxDepth === "number") {
        setMaxDepth(parsed.maxDepth);
      }
      if (Array.isArray(parsed.securityChecks) && parsed.securityChecks.length > 0) {
        setSecurityChecks(parsed.securityChecks);
      }
      if (parsed.behavior) {
        setBehavior((current) => ({ ...current, ...parsed.behavior }));
      }
    } catch {
      localStorage.removeItem("statqa_scan_settings");
    }

    setSettingsHydrated(true);
  }, []);

  useEffect(() => {
    if (!settingsHydrated) {
      return;
    }

    localStorage.setItem(
      "statqa_scan_settings",
      JSON.stringify({
        selectedSuites,
        maxPages,
        maxDepth,
        securityChecks,
        behavior
      })
    );
  }, [settingsHydrated, selectedSuites, maxPages, maxDepth, securityChecks, behavior]);

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
    setActiveView("overview");
    if (analysis) {
      setActivePage("reports");
    }
  }, [analysis?.createdAt]);

  useEffect(() => {
    if (!loading) {
      return;
    }

    setElapsedSeconds(0);
    const timer = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [loading]);

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

  async function handleCopyMarkdownReport() {
    if (!analysis) {
      return;
    }

    const severity = analysis.totals.issuesBySeverity;
    const topHighlights = analysis.highlights
      .map((issue) => `- [${issue.severity}] ${issue.message} (${issue.pageUrl})\n  Fix: ${issue.recommendation}`)
      .join("\n");
    const categoryLines = Object.entries(analysis.categoryBreakdown)
      .sort((left, right) => right[1] - left[1])
      .map(([category, count]) => `- ${category}: ${count}`)
      .join("\n");
    const fixToday = allIssues
      .filter((issue) => issue.severity === "critical" || issue.severity === "error")
      .slice(0, 8)
      .map((issue) => `- [ ] ${issue.message} - ${issue.recommendation}`)
      .join("\n");

    const report = [
      `# StatQA report for ${analysis.rootUrl}`,
      "",
      `Score: ${analysis.score}/100 (${analysis.healthLabel})`,
      `Suites run: ${(analysis.testSuites ?? ["content", "behavior", "security"]).join(", ")}`,
      `Pages scanned: ${analysis.pagesScanned}`,
      `Average load time: ${analysis.totals.averageLoadTimeMs} ms`,
      "",
      "## Severity totals",
      "",
      `- Critical: ${severity.critical}`,
      `- Errors: ${severity.error}`,
      `- Warnings: ${severity.warning}`,
      `- Info: ${severity.info}`,
      "",
      "## Category breakdown",
      "",
      categoryLines || "- No issue categories found",
      "",
      "## Top highlights",
      "",
      topHighlights || "- No high-priority findings",
      "",
      "## Fix today",
      "",
      fixToday || "- [ ] No launch blockers found",
      "",
      `Generated: ${new Date(analysis.createdAt).toLocaleString()}`
    ].join("\n");

    await navigator.clipboard.writeText(report);
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
  const estimatedSeconds = estimateScanSeconds(url || user.websiteUrl || "", maxPages);
  const reportTabs = [
    { id: "overview", label: "Overview" },
    { id: "pages", label: "Pages" },
    { id: "behavior", label: "Behavior" },
    { id: "security", label: "Security" },
    { id: "issues", label: "All issues" }
  ] as const;

  function toggleSuite(suite: string) {
    setSelectedSuites((current) => {
      if (current.includes(suite)) {
        return current.length === 1 ? current : current.filter((item) => item !== suite);
      }

      return [...current, suite];
    });
  }

  function toggleSecurityCheck(check: string) {
    setSecurityChecks((current) => {
      if (current.includes(check)) {
        return current.length === 1 ? current : current.filter((item) => item !== check);
      }

      return [...current, check];
    });
  }

  function resetScanDefaults() {
    setSelectedSuites(["behavior", "security"]);
    setMaxPages(30);
    setMaxDepth(3);
    setSecurityChecks(["https", "hsts", "csp", "clickjacking", "mixed-content", "insecure-forms", "password-http"]);
    setBehavior({
      testForms: true,
      testSearch: true,
      testButtons: true,
      testLinks: true,
      sampleText: "statqa test",
      sampleEmail: "statqa@example.com",
      samplePhone: "5550100",
      samplePassword: "StatQA-Test-123!",
      sampleUrl: "https://example.com"
    });
  }

  async function selectHistory(analysisId: string) {
    await onSelectHistory(analysisId);
    setActivePage("reports");
  }

  function getTargetUrl(): string {
    return url.trim() || analysis?.rootUrl || user.websiteUrl || "";
  }

  function runCheck(testSuites: string[], overrides: Partial<AnalyzeRequest> = {}) {
    const targetUrl = overrides.url || getTargetUrl();
    if (!targetUrl) {
      setActivePage("scan");
      return;
    }

    void onAnalyze({
      url: targetUrl,
      testSuites,
      maxPages,
      maxDepth,
      behavior,
      securityChecks,
      ...overrides
    });
    setActivePage("reports");
  }

  function rerunReport() {
    if (!analysis) {
      return;
    }

    runCheck(analysis.testSuites ?? selectedSuites, {
      url: analysis.rootUrl,
      securityChecks: analysis.securityChecks ?? securityChecks
    });
  }

  function rerunIssue(issue: AnalysisIssue) {
    const securityCheck = issue.meta?.securityCheck;
    const suites = issue.category === "security" ? ["security"] : issue.category === "behavior" ? ["behavior"] : ["content"];

    runCheck(suites, {
      url: issue.pageUrl,
      maxPages: 1,
      maxDepth: 0,
      securityChecks: typeof securityCheck === "string" ? [securityCheck] : securityChecks
    });
  }

  const reportContent = analysis ? (
    <>
      <section className="report-tabs panel">
        {reportTabs.map((tab) => (
          <button
            key={tab.id}
            className={activeView === tab.id ? "sidebar-item active" : "sidebar-item"}
            onClick={() => setActiveView(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </section>
      {activeView === "overview" ? (
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
          <BusinessImpact analysis={analysis} />
          <RemediationPlan issues={allIssues} />
          <Highlights highlights={analysis.highlights} />
          <MetricsPanel metrics={metrics} />
        </>
      ) : null}
      {activeView === "pages" ? <PageBreakdown pages={analysis.pageResults} /> : null}
      {activeView === "behavior" ? (
        <BehaviorTests analysis={analysis} issues={allIssues} onRerunIssue={rerunIssue} />
      ) : null}
      {activeView === "security" ? <SecurityPanel issues={allIssues} onRerunIssue={rerunIssue} /> : null}
      {activeView === "issues" ? (
        <section className="content-grid">
          <Sidebar categories={categories} activeCategory={activeCategory} onSelect={setActiveCategory} />
          <IssueList issues={filteredIssues} activeCategoryLabel={activeCategoryLabel} onRerunIssue={rerunIssue} />
        </section>
      ) : null}
      <ReportActions
        onExportJson={handleExportJson}
        onCopySummary={handleCopySummary}
        onCopyMarkdownReport={handleCopyMarkdownReport}
        onRerunReport={rerunReport}
      />
    </>
  ) : (
    <section className="panel">
      <div className="panel-header">
        <h2>No report loaded</h2>
        <p>This page shows full-site scan reports. Generated test run results are shown in QA reporting.</p>
      </div>
      <div className="actions-row">
        <button className="primary-button" type="button" onClick={() => setActivePage("qa-reports")}>
          Open QA reporting
        </button>
        <button className="secondary-button" type="button" onClick={() => setActivePage("history")}>
          View scan history
        </button>
      </div>
    </section>
  );

  return (
    <div className="dashboard-shell">
      <TopBar
        email={user.email}
        fullName={user.fullName}
        companyName={user.companyName}
        analysesCount={user.analysesCount}
        onLogout={onLogout}
      />
      <main className="app-layout">
        <AppSidebar activePage={activePage} onSelect={setActivePage} />
        <div className="dashboard-content">
          {error ? <p className="error-banner">{error}</p> : null}
          {loading ? (
            <ScanProgress
              loading={loading}
              estimatedSeconds={estimatedSeconds}
              elapsedSeconds={elapsedSeconds}
              targetUrl={url}
              job={activeJob}
            />
          ) : null}
          {loading && activeJob ? (
            <ScanProgress
              loading={loading}
              estimatedSeconds={estimatedSeconds}
              elapsedSeconds={elapsedSeconds}
              targetUrl={url}
              job={activeJob}
              floating
            />
          ) : null}

          {activePage === "scan" ? (
            <>
              <AccountProfile user={user} onUseWebsite={setUrl} />
              <UrlInput
                value={url}
                loading={loading}
                estimatedSeconds={estimatedSeconds}
                selectedSuites={selectedSuites}
                onToggleSuite={toggleSuite}
                onChange={setUrl}
                onSubmit={() => runCheck(selectedSuites, { url })}
              />
              {!analysis && !loading ? (
                <section className="panel">
                  <div className="panel-header">
                    <h2>Ready for analysis</h2>
                    <p>Configure checks from the sidebar or run a full scan with the current defaults.</p>
                  </div>
                </section>
              ) : null}
            </>
          ) : null}

          {activePage === "static" ? (
            <StaticAnalysisSetup
              selectedSuites={selectedSuites}
              onToggleSuite={toggleSuite}
              onRun={() => runCheck(["content"])}
              loading={loading}
            />
          ) : null}
          {activePage === "behavior" ? (
            <BehaviorSetup
              selectedSuites={selectedSuites}
              behavior={behavior}
              onToggleSuite={toggleSuite}
              onBehaviorChange={setBehavior}
              onRun={() => runCheck(["behavior"])}
              loading={loading}
            />
          ) : null}
          {activePage === "security" ? (
            <SecuritySetup
              selectedSuites={selectedSuites}
              securityChecks={securityChecks}
              onToggleSuite={toggleSuite}
              onToggleSecurityCheck={toggleSecurityCheck}
              onRun={() => runCheck(["security"])}
              loading={loading}
            />
          ) : null}
          {activePage === "reports" ? reportContent : null}
          {activePage.startsWith("qa-") ? <QaWorkspace activePage={activePage} defaultUrl={getTargetUrl()} /> : null}
          {activePage === "history" ? (
            <HistoryList history={history} activeAnalysisId={activeAnalysisId} onSelect={selectHistory} />
          ) : null}
          {activePage === "settings" ? (
            <section className="panel settings-panel">
              <div className="panel-header">
                <p className="eyebrow">Settings</p>
                <h2>Scan defaults</h2>
                <p>Customize the defaults used when starting a new scan.</p>
              </div>
              <div className="settings-grid">
                <div className="setup-card">
                  <strong>Crawl scope</strong>
                  <p>
                    Up to {maxPages} pages, depth {maxDepth}
                  </p>
                </div>
                <div className="settings-controls">
                  <label>
                    Max pages
                    <input
                      type="number"
                      min="1"
                      max="150"
                      value={maxPages}
                      onChange={(event) => setMaxPages(Number(event.target.value))}
                    />
                  </label>
                  <label>
                    Max depth
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={maxDepth}
                      onChange={(event) => setMaxDepth(Number(event.target.value))}
                    />
                  </label>
                </div>
                <div className="setup-card">
                  <strong>Enabled suites</strong>
                  <p>{selectedSuites.join(", ")}</p>
                </div>
                <div className="setup-card">
                  <strong>Security checks</strong>
                  <p>{securityChecks.join(", ")}</p>
                </div>
                <div className="setup-card">
                  <strong>Behavior mode</strong>
                  <p>
                    Forms {behavior.testForms ? "on" : "off"}, search {behavior.testSearch ? "on" : "off"}, buttons{" "}
                    {behavior.testButtons ? "on" : "off"}, links {behavior.testLinks ? "on" : "off"}
                  </p>
                </div>
              </div>
              <div className="settings-section">
                <h3>Default suites</h3>
                <div className="suite-toggle-row">
                  {testSuites.map((suite) => (
                    <label key={suite.id} className="suite-toggle">
                      <input
                        type="checkbox"
                        checked={selectedSuites.includes(suite.id)}
                        onChange={() => toggleSuite(suite.id)}
                        disabled={selectedSuites.length === 1 && selectedSuites.includes(suite.id)}
                      />
                      {suite.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="settings-section">
                <h3>Default behavior mode</h3>
                <div className="suite-toggle-row">
                  <label className="suite-toggle">
                    <input
                      type="checkbox"
                      checked={behavior.testForms}
                      onChange={(event) => setBehavior({ ...behavior, testForms: event.target.checked })}
                    />
                    Forms
                  </label>
                  <label className="suite-toggle">
                    <input
                      type="checkbox"
                      checked={behavior.testSearch}
                      onChange={(event) => setBehavior({ ...behavior, testSearch: event.target.checked })}
                    />
                    Search
                  </label>
                  <label className="suite-toggle">
                    <input
                      type="checkbox"
                      checked={behavior.testButtons}
                      onChange={(event) => setBehavior({ ...behavior, testButtons: event.target.checked })}
                    />
                    Buttons
                  </label>
                  <label className="suite-toggle">
                    <input
                      type="checkbox"
                      checked={behavior.testLinks}
                      onChange={(event) => setBehavior({ ...behavior, testLinks: event.target.checked })}
                    />
                    Links
                  </label>
                </div>
              </div>
              <div className="settings-section">
                <h3>Default security checks</h3>
                <div className="setup-grid">
                  {securityOptions.map((option) => (
                    <label key={option.id} className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={securityChecks.includes(option.id)}
                        onChange={() => toggleSecurityCheck(option.id)}
                        disabled={securityChecks.length === 1 && securityChecks.includes(option.id)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="actions-row">
                <button className="secondary-button" onClick={resetScanDefaults}>
                  Reset scan defaults
                </button>
              </div>
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}
