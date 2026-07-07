import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../lib/api";
import type {
  QaAiStatus,
  QaDataset,
  QaGeneratedTest,
  QaGenerationMeta,
  QaReportSummary,
  QaRunSchedule,
  QaSavedDataset,
  QaTestRun
} from "../lib/types";

interface QaWorkspaceProps {
  activePage: string;
  defaultUrl: string;
}

const TEST_LIST_PAGE_SIZE = 20;
const DEFAULT_QA_PROJECT_NAME = "Default workspace";

function normalizeProjectName(value: string) {
  const trimmed = value.trim();
  return trimmed || DEFAULT_QA_PROJECT_NAME;
}

function qaProjectPath(path: string, projectName: string, params: Record<string, string> = {}) {
  const search = new URLSearchParams(params);
  search.set("projectName", normalizeProjectName(projectName));
  return `${path}?${search.toString()}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function filterTests(tests: QaGeneratedTest[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return tests;
  }

  return tests.filter((test) =>
    [test.title, test.riskArea, test.priority, test.testType, test.targetUrl, test.rationale]
      .join(" ")
      .toLowerCase()
      .includes(normalized)
  );
}

function filterRuns(runs: QaTestRun[], status: "all" | QaTestRun["status"]) {
  if (status === "all") {
    return runs;
  }

  return runs.filter((run) => run.status === status);
}

function RunFilters({
  status,
  onStatusChange
}: {
  status: "all" | QaTestRun["status"];
  onStatusChange: (status: "all" | QaTestRun["status"]) => void;
}) {
  return (
    <div className="qa-filter-row">
      <label>
        Run status
        <select value={status} onChange={(event) => onStatusChange(event.target.value as "all" | QaTestRun["status"])}>
          <option value="all">All runs</option>
          <option value="PASSED">Passed</option>
          <option value="FAILED">Failed</option>
          <option value="NEEDS_REVIEW">Needs review</option>
        </select>
      </label>
    </div>
  );
}

function BulkTestActions({
  selectedCount,
  visibleTests,
  mode,
  loading,
  onSelectVisible,
  onClear,
  onArchive,
  onRestore,
  onDelete
}: {
  selectedCount: number;
  visibleTests: QaGeneratedTest[];
  mode: "active" | "archived";
  loading: boolean;
  onSelectVisible: (tests: QaGeneratedTest[]) => void;
  onClear: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="qa-bulk-actions">
      <span>{selectedCount} selected</span>
      <button className="secondary-button" type="button" disabled={loading || !visibleTests.length} onClick={() => onSelectVisible(visibleTests)}>
        Select visible
      </button>
      <button className="secondary-button" type="button" disabled={loading || !selectedCount} onClick={onClear}>
        Clear
      </button>
      {mode === "active" ? (
        <button className="secondary-button" type="button" disabled={loading || !selectedCount} onClick={onArchive}>
          Archive selected
        </button>
      ) : (
        <button className="secondary-button" type="button" disabled={loading || !selectedCount} onClick={onRestore}>
          Restore selected
        </button>
      )}
      <button className="secondary-button danger-button" type="button" disabled={loading || !selectedCount} onClick={onDelete}>
        Delete selected
      </button>
    </div>
  );
}

function ListLimitControls({
  total,
  visible,
  onShowMore,
  onShowAll,
  onReset
}: {
  total: number;
  visible: number;
  onShowMore: () => void;
  onShowAll: () => void;
  onReset: () => void;
}) {
  if (total <= TEST_LIST_PAGE_SIZE) {
    return null;
  }

  return (
    <div className="qa-list-controls">
      <span>Showing {Math.min(visible, total)} of {total} tests</span>
      {visible < total ? (
        <>
          <button className="secondary-button" type="button" onClick={onShowMore}>
            Show 20 more
          </button>
          <button className="secondary-button" type="button" onClick={onShowAll}>
            Show all
          </button>
        </>
      ) : (
        <button className="secondary-button" type="button" onClick={onReset}>
          Show fewer
        </button>
      )}
    </div>
  );
}

function WorkspaceField({
  projectName,
  projects,
  onProjectNameChange
}: {
  projectName: string;
  projects: string[];
  onProjectNameChange: (projectName: string) => void;
}) {
  const options = Array.from(new Set([DEFAULT_QA_PROJECT_NAME, ...projects, normalizeProjectName(projectName)]));

  return (
    <>
      <label>
        Workspace
        <input
          list="qa-project-options"
          value={projectName}
          onChange={(event) => onProjectNameChange(event.target.value)}
          onBlur={() => onProjectNameChange(normalizeProjectName(projectName))}
          placeholder={DEFAULT_QA_PROJECT_NAME}
        />
      </label>
      <datalist id="qa-project-options">
        {options.map((project) => (
          <option key={project} value={project} />
        ))}
      </datalist>
    </>
  );
}

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

function getRunJobId(run: QaTestRun): string | null {
  return typeof run.details?.jobId === "string" ? run.details.jobId : null;
}

function getRunTrace(run: QaTestRun): Array<{ status?: string; phase?: string; message?: string; at?: string; percent?: number }> {
  return Array.isArray(run.details?.trace) ? run.details.trace as Array<{ status?: string; phase?: string; message?: string; at?: string; percent?: number }> : [];
}

function RunRow({ run, onRefresh }: { run: QaTestRun; onRefresh: (run: QaTestRun) => void }) {
  const trace = getRunTrace(run);
  const jobId = getRunJobId(run);

  return (
    <div className="test-row">
      <strong>{run.test?.title ?? "Generated test"}</strong>
      <span>{run.status} - {run.projectName} - {formatDate(run.createdAt)}</span>
      <p>{run.summary}</p>
      {jobId ? <p className="issue-url">Job: {jobId}</p> : null}
      {trace.length ? (
        <ol className="qa-trace-list">
          {trace.map((event, index) => (
            <li key={`${event.status ?? "trace"}-${index}`}>
              <strong>{event.phase ?? event.status ?? "trace"}</strong>
              <span>{event.percent !== undefined ? ` ${event.percent}% -` : ""} {event.message}</span>
            </li>
          ))}
        </ol>
      ) : null}
      <div className="actions-row">
        <button className="secondary-button" type="button" onClick={() => onRefresh(run)}>
          Refresh result
        </button>
      </div>
    </div>
  );
}

function TestCard({
  test,
  runStatus,
  isRunning,
  expanded,
  selected,
  onSelect,
  onToggleExpanded,
  onArchive,
  onSchedule,
  onRun
}: {
  test: QaGeneratedTest;
  runStatus?: string;
  isRunning: boolean;
  expanded: boolean;
  selected: boolean;
  onSelect: (test: QaGeneratedTest, selected: boolean) => void;
  onToggleExpanded: (test: QaGeneratedTest) => void;
  onArchive: (test: QaGeneratedTest, archived: boolean) => void;
  onSchedule: (test: QaGeneratedTest) => void;
  onRun: (test: QaGeneratedTest) => void;
}) {
  return (
    <article className={`qa-test-card ${expanded ? "qa-test-card-expanded" : "qa-test-card-collapsed"}`}>
      <div className="issue-head">
        <label className="qa-select-test">
          <input type="checkbox" checked={selected} onChange={(event) => onSelect(test, event.target.checked)} />
          Select
        </label>
        <span className={`severity severity-${test.priority === "high" ? "error" : test.priority === "critical" ? "critical" : "info"}`}>
          {test.priority}
        </span>
        <span className="category-badge">{test.testType}</span>
      </div>
      <h3>{test.title}</h3>
      <p>{test.rationale}</p>
      <p className="issue-url">{test.targetUrl}</p>
      <div className="qa-card-summary">
        <span>{test.projectName}</span>
        <span>{test.riskArea}</span>
        <span>{test.steps.length} steps</span>
        <span>{test.assertions.length} assertions</span>
      </div>
      {expanded ? (
        <div className="qa-columns">
          <div>
            <strong>Steps</strong>
            <ol>
              {test.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
          <div>
            <strong>Assertions</strong>
            <ul>
              {test.assertions.map((assertion) => (
                <li key={assertion}>{assertion}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      {runStatus ? <p className="qa-inline-status">{runStatus}</p> : null}
      <div className="actions-row">
        <button className="primary-button" type="button" disabled={isRunning} onClick={() => onRun(test)}>
          {isRunning ? "Starting run..." : "Run test"}
        </button>
        <button
          className="secondary-button"
          type="button"
          aria-expanded={expanded}
          onClick={() => onToggleExpanded(test)}
        >
          {expanded ? "Hide details" : "Details"}
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={isRunning}
          onClick={() => onArchive(test, test.status !== "ARCHIVED")}
        >
          {test.status === "ARCHIVED" ? "Restore" : "Archive"}
        </button>
        <button className="secondary-button" type="button" disabled={isRunning || test.status === "ARCHIVED"} onClick={() => onSchedule(test)}>
          Schedule
        </button>
      </div>
    </article>
  );
}

export function QaWorkspace({ activePage, defaultUrl }: QaWorkspaceProps) {
  const [tests, setTests] = useState<QaGeneratedTest[]>([]);
  const [archivedTests, setArchivedTests] = useState<QaGeneratedTest[]>([]);
  const [runs, setRuns] = useState<QaTestRun[]>([]);
  const [summary, setSummary] = useState<QaReportSummary | null>(null);
  const [aiStatus, setAiStatus] = useState<QaAiStatus | null>(null);
  const [dataset, setDataset] = useState<QaDataset | null>(null);
  const [savedDatasets, setSavedDatasets] = useState<QaSavedDataset[]>([]);
  const [schedules, setSchedules] = useState<QaRunSchedule[]>([]);
  const [projects, setProjects] = useState<string[]>([DEFAULT_QA_PROJECT_NAME]);
  const [lastGenerationMeta, setLastGenerationMeta] = useState<QaGenerationMeta | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [runningTestId, setRunningTestId] = useState<string | null>(null);
  const [runFeedback, setRunFeedback] = useState<Record<string, string>>({});
  const [targetUrl, setTargetUrl] = useState(defaultUrl);
  const [projectName, setProjectName] = useState(DEFAULT_QA_PROJECT_NAME);
  const [riskContext, setRiskContext] = useState("Checkout, signup, search, navigation, forms, and security headers");
  const [pageContext, setPageContext] = useState("");
  const [testCount, setTestCount] = useState(4);
  const [scenario, setScenario] = useState("Signup form with realistic valid and invalid values");
  const [fields, setFields] = useState("email, fullName, companyName, password, phone");
  const [testSearch, setTestSearch] = useState("");
  const [runStatusFilter, setRunStatusFilter] = useState<"all" | QaTestRun["status"]>("all");
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
  const [expandedTestIds, setExpandedTestIds] = useState<string[]>([]);
  const [testListLimit, setTestListLimit] = useState(TEST_LIST_PAGE_SIZE);
  const [scheduleFrequency, setScheduleFrequency] = useState<"daily" | "weekly" | "monthly">("weekly");

  const activeTests = useMemo(() => tests.filter((test) => test.status === "ACTIVE"), [tests]);
  const filteredActiveTests = useMemo(() => filterTests(activeTests, testSearch), [activeTests, testSearch]);
  const filteredArchivedTests = useMemo(() => filterTests(archivedTests, testSearch), [archivedTests, testSearch]);
  const visibleActiveTests = useMemo(() => filteredActiveTests.slice(0, testListLimit), [filteredActiveTests, testListLimit]);
  const visibleArchivedTests = useMemo(() => filteredArchivedTests.slice(0, testListLimit), [filteredArchivedTests, testListLimit]);
  const filteredRuns = useMemo(() => filterRuns(runs, runStatusFilter), [runs, runStatusFilter]);
  const filteredSummaryRuns = useMemo(
    () => filterRuns(summary?.recentRuns ?? [], runStatusFilter),
    [summary?.recentRuns, runStatusFilter]
  );
  const expandedTestIdSet = useMemo(() => new Set(expandedTestIds), [expandedTestIds]);
  const normalizedProjectName = useMemo(() => normalizeProjectName(projectName), [projectName]);

  async function refreshQa() {
    const [active, archived, qaRuns, qaSummary, status, dataHistory, scheduleList, projectList] = await Promise.all([
      apiRequest<{ tests: QaGeneratedTest[] }>(qaProjectPath("/qa/tests", normalizedProjectName)),
      apiRequest<{ tests: QaGeneratedTest[] }>(qaProjectPath("/qa/tests", normalizedProjectName, { status: "ARCHIVED" })),
      apiRequest<{ runs: QaTestRun[] }>(qaProjectPath("/qa/runs", normalizedProjectName)),
      apiRequest<{ summary: QaReportSummary }>(qaProjectPath("/qa/reports/summary", normalizedProjectName)),
      apiRequest<QaAiStatus>("/qa/ai/status"),
      apiRequest<{ datasets: QaSavedDataset[] }>(qaProjectPath("/qa/test-data", normalizedProjectName)),
      apiRequest<{ schedules: QaRunSchedule[] }>(qaProjectPath("/qa/schedules", normalizedProjectName)),
      apiRequest<{ projects: string[] }>("/qa/projects")
    ]);
    setTests(active.tests);
    setArchivedTests(archived.tests);
    setRuns(qaRuns.runs);
    setSummary(qaSummary.summary);
    setAiStatus(status);
    setSavedDatasets(dataHistory.datasets);
    setSchedules(scheduleList.schedules);
    setProjects(Array.from(new Set([DEFAULT_QA_PROJECT_NAME, ...projectList.projects, normalizedProjectName])));
  }

  function selectTest(test: QaGeneratedTest, selected: boolean) {
    setSelectedTestIds((current) => {
      if (selected) {
        return current.includes(test.id) ? current : [...current, test.id];
      }

      return current.filter((id) => id !== test.id);
    });
  }

  function selectVisibleTests(visibleTests: QaGeneratedTest[]) {
    setSelectedTestIds(visibleTests.map((test) => test.id));
  }

  function clearSelectedTests() {
    setSelectedTestIds([]);
  }

  function toggleTestExpanded(test: QaGeneratedTest) {
    setExpandedTestIds((current) =>
      current.includes(test.id) ? current.filter((id) => id !== test.id) : [...current, test.id]
    );
  }

  async function refreshRun(run: QaTestRun) {
    setLoading(true);
    setMessage("");
    try {
      await apiRequest<{ run: QaTestRun }>(`/qa/runs/${run.id}/refresh`, {
        method: "POST"
      });
      await refreshQa();
      setMessage("QA run result refreshed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to refresh QA run.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshAllRuns() {
    setLoading(true);
    setMessage("");
    try {
      await Promise.all(runs.slice(0, 20).map((run) => apiRequest(`/qa/runs/${run.id}/refresh`, { method: "POST" })));
      await refreshQa();
      setMessage("Visible QA run results refreshed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to refresh QA runs.");
    } finally {
      setLoading(false);
    }
  }

  function exportQaJson() {
    downloadText(
      "statqa-qa-report.json",
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          projectName: normalizedProjectName,
          summary,
          activeTests,
          archivedTests,
          runs
        },
        null,
        2
      ),
      "application/json"
    );
  }

  function exportQaMarkdown() {
    const statusLines = Object.entries(summary?.runsByStatus ?? {})
      .map(([status, count]) => `- ${status}: ${count}`)
      .join("\n");
    const testLines = activeTests
      .slice(0, 50)
      .map((test) => `- [${test.priority}] ${test.title} (${test.testType}) - ${test.targetUrl}`)
      .join("\n");
    const runLines = runs
      .slice(0, 50)
      .map((run) => `- [${run.status}] ${run.test?.title ?? "Generated test"} - ${run.summary}`)
      .join("\n");

    downloadText(
      "statqa-qa-report.md",
      [
        "# StatQA QA Report",
        "",
        `Generated: ${new Date().toLocaleString()}`,
        `Workspace: ${normalizedProjectName}`,
        "",
        "## Summary",
        "",
        `- Active tests: ${summary?.activeTests ?? activeTests.length}`,
        `- Archived tests: ${summary?.archivedTests ?? archivedTests.length}`,
        `- Recent runs: ${summary?.totalRuns ?? runs.length}`,
        "",
        "## Runs by status",
        "",
        statusLines || "- No runs yet",
        "",
        "## Active tests",
        "",
        testLines || "- No active tests",
        "",
        "## Recent runs",
        "",
        runLines || "- No recent runs"
      ].join("\n"),
      "text/markdown"
    );
  }


  function formatGenerationMessage(kind: "tests" | "dataset", meta: QaGenerationMeta, count?: number) {
    if (meta.source === "groq") {
      const amount = typeof count === "number" ? ` ${count}` : "";
      return `Generated${amount} ${kind === "tests" ? "tests" : "test data"} with Groq (${aiStatus?.model ?? "configured model"}).`;
    }

    return `Used local fallback for ${kind === "tests" ? "test generation" : "test data"}. ${meta.fallbackReason ?? "Groq was unavailable."}`;
  }

  useEffect(() => {
    void refreshQa().catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load QA workspace."));
  }, [normalizedProjectName]);

  useEffect(() => {
    if (defaultUrl && !targetUrl) {
      setTargetUrl(defaultUrl);
    }
  }, [defaultUrl, targetUrl]);

  useEffect(() => {
    setTestListLimit(TEST_LIST_PAGE_SIZE);
  }, [testSearch, activePage]);

  async function generateTests() {
    setLoading(true);
    setMessage("");
    try {
      const response = await apiRequest<{ tests: QaGeneratedTest[]; meta: QaGenerationMeta }>("/qa/tests/generate", {
        method: "POST",
        body: JSON.stringify({
          targetUrl,
          projectName: normalizedProjectName,
          riskContext,
          pageContext: pageContext || undefined,
          count: testCount
        })
      });
      setLastGenerationMeta(response.meta);
      setTests((current) => [...response.tests, ...current]);
      await refreshQa();
      setMessage(formatGenerationMessage("tests", response.meta, response.tests.length));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to generate tests.");
    } finally {
      setLoading(false);
    }
  }

  async function archiveTest(test: QaGeneratedTest, archived: boolean) {
    setLoading(true);
    setMessage("");
    try {
      await apiRequest(`/qa/tests/${test.id}/archive`, {
        method: "PATCH",
        body: JSON.stringify({ archived })
      });
      await refreshQa();
      setMessage(archived ? "Test archived." : "Test restored.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update archive state.");
    } finally {
      setLoading(false);
    }
  }

  async function bulkArchiveTests(archived: boolean) {
    if (!selectedTestIds.length) {
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const response = await apiRequest<{ updated: number }>("/qa/tests/bulk/archive", {
        method: "POST",
        body: JSON.stringify({ ids: selectedTestIds, archived })
      });
      clearSelectedTests();
      await refreshQa();
      setMessage(`${response.updated} test${response.updated === 1 ? "" : "s"} ${archived ? "archived" : "restored"}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update selected tests.");
    } finally {
      setLoading(false);
    }
  }

  async function bulkDeleteTests() {
    if (!selectedTestIds.length) {
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const response = await apiRequest<{ deleted: number }>("/qa/tests/bulk", {
        method: "DELETE",
        body: JSON.stringify({ ids: selectedTestIds })
      });
      clearSelectedTests();
      await refreshQa();
      setMessage(`${response.deleted} generated test${response.deleted === 1 ? "" : "s"} deleted.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete selected tests.");
    } finally {
      setLoading(false);
    }
  }

  async function scheduleTest(test: QaGeneratedTest) {
    setLoading(true);
    setMessage("");
    try {
      await apiRequest<{ schedule: QaRunSchedule }>("/qa/schedules", {
        method: "POST",
        body: JSON.stringify({ testId: test.id, frequency: scheduleFrequency })
      });
      await refreshQa();
      setMessage(`Scheduled ${scheduleFrequency} QA run for ${test.title}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to schedule test.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleSchedule(schedule: QaRunSchedule) {
    setLoading(true);
    setMessage("");
    try {
      await apiRequest<{ schedule: QaRunSchedule }>(`/qa/schedules/${schedule.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !schedule.enabled })
      });
      await refreshQa();
      setMessage(schedule.enabled ? "Schedule disabled." : "Schedule enabled.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update schedule.");
    } finally {
      setLoading(false);
    }
  }

  async function runDueSchedulesNow() {
    setLoading(true);
    setMessage("");
    try {
      const result = await apiRequest<{ scanned: number; started: number }>(qaProjectPath("/qa/schedules/run-due", normalizedProjectName), {
        method: "POST"
      });
      await refreshQa();
      setMessage(`Checked ${result.scanned} due schedule${result.scanned === 1 ? "" : "s"} and started ${result.started} run${result.started === 1 ? "" : "s"}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to run due schedules.");
    } finally {
      setLoading(false);
    }
  }

  async function runTest(test: QaGeneratedTest) {
    setLoading(true);
    setRunningTestId(test.id);
    setMessage("");
    setRunFeedback((current) => ({
      ...current,
      [test.id]: "Starting focused browser scan..."
    }));
    try {
      const response = await apiRequest<{ run: QaTestRun; job: { jobId: string } }>(`/qa/tests/${test.id}/run`, {
        method: "POST"
      });
      await refreshQa();
      const statusText = `Run started. Job ${response.job.jobId} is tracking the browser scan. Open Test running or QA reporting to review progress.`;
      setMessage(statusText);
      setRunFeedback((current) => ({
        ...current,
        [test.id]: statusText
      }));
    } catch (error) {
      const statusText = error instanceof Error ? error.message : "Unable to run test.";
      setMessage(statusText);
      setRunFeedback((current) => ({
        ...current,
        [test.id]: statusText
      }));
    } finally {
      setLoading(false);
      setRunningTestId(null);
    }
  }

  async function generateData() {
    setLoading(true);
    setMessage("");
    try {
      const response = await apiRequest<{ dataset: QaDataset; meta: QaGenerationMeta; savedDataset: QaSavedDataset }>("/qa/test-data/generate", {
        method: "POST",
        body: JSON.stringify({
          targetUrl,
          projectName: normalizedProjectName,
          scenario,
          fields: fields.split(",").map((field) => field.trim()).filter(Boolean),
          count: 5
        })
      });
      setLastGenerationMeta(response.meta);
      setDataset(response.dataset);
      setSavedDatasets((current) => [response.savedDataset, ...current]);
      setMessage(formatGenerationMessage("dataset", response.meta));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to generate test data.");
    } finally {
      setLoading(false);
    }
  }

  if (activePage === "qa-generate") {
    return (
      <section className="panel qa-panel">
        <div className="panel-header">
          <p className="eyebrow">Groq integration</p>
          <h2>AI test generation</h2>
          <p>Create risk-driven tests from the target URL and context.</p>
        </div>
        <div className={aiStatus?.groqConfigured ? "qa-source-banner qa-source-ready" : "qa-source-banner qa-source-fallback"}>
          {aiStatus?.groqConfigured
            ? `Groq is configured. Generation will use ${aiStatus.model}.`
            : "Groq is not configured for the running backend. Generation will use local fallback data."}
        </div>
        {message ? <p className="info-banner">{message}</p> : null}
        {lastGenerationMeta?.source === "fallback" ? <p className="qa-inline-status">{lastGenerationMeta.fallbackReason}</p> : null}
        <div className="qa-filter-row">
          <WorkspaceField projectName={projectName} projects={projects} onProjectNameChange={setProjectName} />
        </div>
        <div className="qa-form-grid">
          <label className="qa-field-wide">
            Target URL
            <input value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} />
          </label>
          <label className="qa-field-short">
            Test count
            <input type="number" min="1" max="100" value={testCount} onChange={(event) => setTestCount(Number(event.target.value))} />
          </label>
          <label className="qa-field-full">
            Risk context
            <textarea value={riskContext} onChange={(event) => setRiskContext(event.target.value)} />
          </label>
          <label className="qa-field-full">
            Page or business context
            <textarea value={pageContext} onChange={(event) => setPageContext(event.target.value)} />
          </label>
        </div>
        <div className="actions-row">
          <button className="primary-button" type="button" disabled={loading} onClick={generateTests}>
            {loading ? "Generating tests..." : "Generate tests"}
          </button>
          <span className="qa-help-text">You can generate up to 100 tests. Large runs are batched and may take longer.</span>
        </div>
        <div className="qa-filter-row">
          <label>
            Search generated tests
            <input value={testSearch} onChange={(event) => setTestSearch(event.target.value)} placeholder="Title, risk, type, or URL" />
          </label>
          <label>
            Schedule frequency
            <select value={scheduleFrequency} onChange={(event) => setScheduleFrequency(event.target.value as "daily" | "weekly" | "monthly")}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
        </div>
        <BulkTestActions
          selectedCount={selectedTestIds.length}
          visibleTests={visibleActiveTests}
          mode="active"
          loading={loading}
          onSelectVisible={selectVisibleTests}
          onClear={clearSelectedTests}
          onArchive={() => bulkArchiveTests(true)}
          onRestore={() => bulkArchiveTests(false)}
          onDelete={bulkDeleteTests}
        />
        <div className="qa-list">
          {visibleActiveTests.map((test) => (
            <TestCard
              key={test.id}
              test={test}
              runStatus={runFeedback[test.id]}
              isRunning={runningTestId === test.id}
              expanded={expandedTestIdSet.has(test.id)}
              selected={selectedTestIds.includes(test.id)}
              onSelect={selectTest}
              onToggleExpanded={toggleTestExpanded}
              onArchive={archiveTest}
              onSchedule={scheduleTest}
              onRun={runTest}
            />
          ))}
          {!filteredActiveTests.length ? <div className="empty-state qa-empty-state">No active tests match this search.</div> : null}
        </div>
        <ListLimitControls
          total={filteredActiveTests.length}
          visible={testListLimit}
          onShowMore={() => setTestListLimit((current) => current + TEST_LIST_PAGE_SIZE)}
          onShowAll={() => setTestListLimit(filteredActiveTests.length)}
          onReset={() => setTestListLimit(TEST_LIST_PAGE_SIZE)}
        />
      </section>
    );
  }

  if (activePage === "qa-archive") {
    return (
      <section className="panel qa-panel">
        <div className="panel-header">
          <p className="eyebrow">Archive</p>
          <h2>Archived tests</h2>
          <p>Keep older generated tests available without cluttering active runs.</p>
        </div>
        {message ? <p className="info-banner">{message}</p> : null}
        <div className="qa-filter-row">
          <WorkspaceField projectName={projectName} projects={projects} onProjectNameChange={setProjectName} />
          <label>
            Search archive
            <input value={testSearch} onChange={(event) => setTestSearch(event.target.value)} placeholder="Title, risk, type, or URL" />
          </label>
        </div>
        <BulkTestActions
          selectedCount={selectedTestIds.length}
          visibleTests={visibleArchivedTests}
          mode="archived"
          loading={loading}
          onSelectVisible={selectVisibleTests}
          onClear={clearSelectedTests}
          onArchive={() => bulkArchiveTests(true)}
          onRestore={() => bulkArchiveTests(false)}
          onDelete={bulkDeleteTests}
        />
        <div className="qa-list">
          {filteredArchivedTests.length ? visibleArchivedTests.map((test) => (
            <TestCard
              key={test.id}
              test={test}
              runStatus={runFeedback[test.id]}
              isRunning={runningTestId === test.id}
              expanded={expandedTestIdSet.has(test.id)}
              selected={selectedTestIds.includes(test.id)}
              onSelect={selectTest}
              onToggleExpanded={toggleTestExpanded}
              onArchive={archiveTest}
              onSchedule={scheduleTest}
              onRun={runTest}
            />
          )) : <div className="empty-state qa-empty-state">No archived tests match this view.</div>}
        </div>
        <ListLimitControls
          total={filteredArchivedTests.length}
          visible={testListLimit}
          onShowMore={() => setTestListLimit((current) => current + TEST_LIST_PAGE_SIZE)}
          onShowAll={() => setTestListLimit(filteredArchivedTests.length)}
          onReset={() => setTestListLimit(TEST_LIST_PAGE_SIZE)}
        />
      </section>
    );
  }

  if (activePage === "qa-run") {
    return (
      <section className="panel qa-panel">
        <div className="panel-header">
          <p className="eyebrow">Execution</p>
          <h2>Test running</h2>
          <p>Run generated tests as focused browser scans and inspect recent run records.</p>
        </div>
        {message ? <p className="info-banner">{message}</p> : null}
        <RunFilters status={runStatusFilter} onStatusChange={setRunStatusFilter} />
        <div className="qa-filter-row">
          <WorkspaceField projectName={projectName} projects={projects} onProjectNameChange={setProjectName} />
          <label>
            Schedule frequency
            <select value={scheduleFrequency} onChange={(event) => setScheduleFrequency(event.target.value as "daily" | "weekly" | "monthly")}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
        </div>
        <div className="qa-list">
          {visibleActiveTests.map((test) => (
            <TestCard
              key={test.id}
              test={test}
              runStatus={runFeedback[test.id]}
              isRunning={runningTestId === test.id}
              expanded={expandedTestIdSet.has(test.id)}
              selected={selectedTestIds.includes(test.id)}
              onSelect={selectTest}
              onToggleExpanded={toggleTestExpanded}
              onArchive={archiveTest}
              onSchedule={scheduleTest}
              onRun={runTest}
            />
          ))}
        </div>
        <ListLimitControls
          total={filteredActiveTests.length}
          visible={testListLimit}
          onShowMore={() => setTestListLimit((current) => current + TEST_LIST_PAGE_SIZE)}
          onShowAll={() => setTestListLimit(filteredActiveTests.length)}
          onReset={() => setTestListLimit(TEST_LIST_PAGE_SIZE)}
        />
        <div className="settings-section">
          <h3>Recent runs</h3>
          {filteredRuns.map((run) => (
            <RunRow key={run.id} run={run} onRefresh={refreshRun} />
          ))}
          {!filteredRuns.length ? <div className="empty-state qa-empty-state">No runs match this status filter.</div> : null}
        </div>
      </section>
    );
  }

  if (activePage === "qa-reports") {
    return (
      <section className="panel qa-panel">
        <div className="panel-header">
          <p className="eyebrow">Reporting</p>
          <h2>QA reporting</h2>
          <p>Track generated coverage, archive volume, and recent execution state.</p>
        </div>
        <div className="qa-filter-row">
          <WorkspaceField projectName={projectName} projects={projects} onProjectNameChange={setProjectName} />
        </div>
        <div className="test-summary-grid">
          <div><span>Active tests</span><strong>{summary?.activeTests ?? 0}</strong></div>
          <div><span>Archived tests</span><strong>{summary?.archivedTests ?? 0}</strong></div>
          <div><span>Recent runs</span><strong>{summary?.totalRuns ?? 0}</strong></div>
        </div>
        <div className="actions-row">
          <button className="secondary-button" type="button" onClick={exportQaJson}>
            Export JSON
          </button>
          <button className="secondary-button" type="button" onClick={exportQaMarkdown}>
            Export Markdown
          </button>
        </div>
        <div className="settings-section">
          <h3>Latest generated tests</h3>
          {(summary?.latestTests ?? []).map((test) => (
            <div className="test-row" key={test.id}>
              <strong>{test.title}</strong>
              <span>{test.priority} - {test.riskArea} - {test.projectName}</span>
            </div>
          ))}
        </div>
        <div className="settings-section">
          <h3>Recent test runs</h3>
          <RunFilters status={runStatusFilter} onStatusChange={setRunStatusFilter} />
          <div className="actions-row">
            <button className="secondary-button" type="button" disabled={loading || !runs.length} onClick={refreshAllRuns}>
              Refresh visible results
            </button>
          </div>
          {filteredSummaryRuns.length ? (
            filteredSummaryRuns.map((run) => (
              <RunRow key={run.id} run={run} onRefresh={refreshRun} />
            ))
          ) : (
            <div className="empty-state qa-empty-state">No generated test runs match this status filter.</div>
          )}
        </div>
        <div className="settings-section">
          <h3>Schedules</h3>
          <div className="actions-row">
            <button className="secondary-button" type="button" disabled={loading} onClick={runDueSchedulesNow}>
              Run due schedules now
            </button>
          </div>
          {schedules.length ? (
            schedules.map((schedule) => (
              <div className="test-row" key={schedule.id}>
                <strong>{schedule.test?.title ?? "Generated test"}</strong>
                <span>
                  {schedule.enabled ? "Enabled" : "Paused"} - {schedule.projectName} - {schedule.frequency} - next {formatDate(schedule.nextRunAt)}
                </span>
                <p className="issue-url">{schedule.targetUrl}</p>
                {schedule.lastRunAt ? <p>Last run: {formatDate(schedule.lastRunAt)}</p> : <p>No runs started by this schedule yet.</p>}
                <div className="actions-row">
                  <button className="secondary-button" type="button" disabled={loading} onClick={() => toggleSchedule(schedule)}>
                    {schedule.enabled ? "Pause" : "Enable"}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state qa-empty-state">No schedules yet. Use Schedule on an active generated test.</div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="panel qa-panel">
      <div className="panel-header">
        <p className="eyebrow">Synthetic data</p>
        <h2>AI test data</h2>
        <p>Generate context-aware data for forms, behavior tests, and edge cases.</p>
      </div>
      <div className={aiStatus?.groqConfigured ? "qa-source-banner qa-source-ready" : "qa-source-banner qa-source-fallback"}>
        {aiStatus?.groqConfigured
          ? `Groq is configured. Test data will use ${aiStatus.model}.`
          : "Groq is not configured for the running backend. Test data will use local fallback values."}
      </div>
      {message ? <p className="info-banner">{message}</p> : null}
      {lastGenerationMeta?.source === "fallback" ? <p className="qa-inline-status">{lastGenerationMeta.fallbackReason}</p> : null}
      <div className="qa-filter-row">
        <WorkspaceField projectName={projectName} projects={projects} onProjectNameChange={setProjectName} />
      </div>
      <div className="qa-form-grid">
        <label className="qa-field-wide">
          Target URL
          <input value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} />
        </label>
        <label className="qa-field-short">
          Fields
          <input value={fields} onChange={(event) => setFields(event.target.value)} />
        </label>
        <label className="qa-field-full">
          Scenario
          <textarea value={scenario} onChange={(event) => setScenario(event.target.value)} />
        </label>
      </div>
      <div className="actions-row">
        <button className="primary-button" type="button" disabled={loading} onClick={generateData}>
          Generate data
        </button>
      </div>
      {dataset ? (
        <pre className="qa-json-preview">{JSON.stringify(dataset, null, 2)}</pre>
      ) : null}
      <div className="settings-section">
        <h3>Saved datasets</h3>
        {savedDatasets.length ? (
          savedDatasets.map((saved) => (
            <div className="test-row" key={saved.id}>
              <strong>{saved.datasetName}</strong>
              <span>{saved.source} - {saved.projectName} - {formatDate(saved.createdAt)}</span>
              <p>{saved.scenario}</p>
              <p className="issue-url">{saved.targetUrl}</p>
              <div className="actions-row">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() =>
                    downloadText(
                      `${saved.datasetName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`,
                      JSON.stringify(saved, null, 2),
                      "application/json"
                    )
                  }
                >
                  Export dataset
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state qa-empty-state">No saved datasets yet.</div>
        )}
      </div>
    </section>
  );
}
