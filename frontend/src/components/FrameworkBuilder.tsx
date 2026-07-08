import { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import { apiRequest } from "../lib/api";
import type {
  QaFrameworkBuilderResult,
  QaFrameworkRequest,
  QaGeneratedFrameworkFile,
  QaManualFrameworkTest
} from "../lib/types";

type EvidenceSummary = {
  pagesAnalyzed: number;
  formsFound: number;
  inputsFound: number;
  buttonsFound: number;
  internalLinksFound: number;
};

type SiteEvidence = {
  targetUrl: string;
  origin: string;
  analyzedAt: string;
  status: "ok" | "partial" | "failed";
  error?: string;
  summary: EvidenceSummary;
  pages: Array<{
    url: string;
    path: string;
    title: string;
    status: number | null;
    headings: Array<{ text: string }>;
    buttons: Array<{ text: string }>;
    links: Array<{ text: string; href: string; internal: boolean }>;
    forms: Array<{ name: string; inputs: Array<Record<string, string | undefined>>; submitLabels: string[] }>;
    textSnippets: string[];
  }>;
};

type FrameworkResult = QaFrameworkBuilderResult & {
  siteEvidence?: SiteEvidence;
  quality?: {
    readinessScore: number;
    runnableSpecCount: number;
    evidenceBackedAssertions: number;
    aiBlueprintsUsed: number;
  };
};

const EMPTY_REQUEST: QaFrameworkRequest = {
  applicationName: "",
  applicationUrl: "",
  productDescription: "",
  mainRoles: ["Visitor"],
  criticalFlows: ["Public page loads", "Internal navigation works", "Visible forms are reviewed safely"],
  businessRules: ["Public pages should respond successfully", "Observed links should remain reachable"],
  riskAreas: ["Broken navigation", "Missing primary content", "Form validation", "Regression risk"],
  supportedBrowsers: ["chromium", "firefox", "webkit"],
  includeCi: true,
  portfolioMode: true
};

const artifactViews = [
  { id: "evidence", label: "Site evidence", description: "Real pages observed before AI generation" },
  { id: "manual", label: "Manual grid", description: "Risk-based source cases" },
  { id: "automation", label: "Automatic code", description: "Evidence-backed Playwright specs" },
  { id: "files", label: "Export files", description: "Preview and download ZIP" }
] as const;

type ArtifactView = (typeof artifactViews)[number]["id"];

function splitLines(value: string): string[] {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function joinLines(value: string[]): string {
  return value.join("\n");
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "statqa-framework";
}

function downloadBlob(filename: string, blob: Blob) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

function shortUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.pathname}${url.search}` || "/";
  } catch {
    return value;
  }
}

function ManualTestGrid({ tests, selectedId, onSelect }: { tests: QaManualFrameworkTest[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <div className="manual-test-grid">
      {tests.map((test) => (
        <button
          key={test.id}
          type="button"
          className={`manual-test-card ${selectedId === test.id ? "active" : ""}`}
          onClick={() => onSelect(test.id)}
        >
          <div className="test-card-header">
            <strong className="test-id">{test.id}</strong>
            <span className={`priority priority-${test.priority}`}>{test.priority}</span>
          </div>
          <h4 className="test-title">{test.title}</h4>
          <p className="test-feature">{test.feature}</p>
          <div className="test-badges">
            <span className={`badge automation-${test.automationSuitability}`}>{test.automationSuitability}</span>
            <span className="badge">{test.classification}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function ManualTestDetail({ test }: { test: QaManualFrameworkTest | null }) {
  if (!test) return null;

  return (
    <article className="manual-test-detail">
      <div className="issue-head">
        <span className="category-badge">{test.id}</span>
        <span className={`severity severity-${test.priority === "critical" ? "critical" : test.priority === "high" ? "error" : "info"}`}>
          {test.priority}
        </span>
        <span className="category-badge">{test.automationSuitability}</span>
      </div>
      <h3>{test.title}</h3>
      <p>{test.objective}</p>
      <div className="artifact-two-column">
        <div>
          <h4>Preconditions</h4>
          <ul>{test.preconditions.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <div>
          <h4>Test data</h4>
          <ul>{test.testData.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      </div>
      <h4>Steps and expected results</h4>
      <ol className="manual-step-list">
        {test.steps.map((step) => (
          <li key={`${test.id}-${step.action}`}>
            <strong>{step.action}</strong>
            <span>{step.expectedResult}</span>
          </li>
        ))}
      </ol>
      <p className="qa-inline-status"><strong>Automation notes:</strong> {test.automationNotes}</p>
      <p className="qa-inline-status"><strong>Tester notes:</strong> {test.testerNotes}</p>
    </article>
  );
}

export function FrameworkBuilder({ defaultUrl, onNavigate }: { defaultUrl: string; onNavigate: (page: string) => void }) {
  const [form, setForm] = useState<QaFrameworkRequest>({ ...EMPTY_REQUEST, applicationUrl: defaultUrl || "" });
  const [rolesText, setRolesText] = useState(joinLines(EMPTY_REQUEST.mainRoles));
  const [flowsText, setFlowsText] = useState(joinLines(EMPTY_REQUEST.criticalFlows));
  const [rulesText, setRulesText] = useState(joinLines(EMPTY_REQUEST.businessRules));
  const [risksText, setRisksText] = useState(joinLines(EMPTY_REQUEST.riskAreas));
  const [result, setResult] = useState<FrameworkResult | null>(null);
  const [artifactView, setArtifactView] = useState<ArtifactView>("evidence");
  const [selectedManualTestId, setSelectedManualTestId] = useState("");
  const [selectedSpecPath, setSelectedSpecPath] = useState("");
  const [selectedFilePath, setSelectedFilePath] = useState("");
  const [fileSearch, setFileSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (defaultUrl && !form.applicationUrl) {
      setForm((current) => ({ ...current, applicationUrl: defaultUrl }));
    }
  }, [defaultUrl, form.applicationUrl]);

  const canGenerate = isValidUrl(form.applicationUrl.trim()) && !loading;
  const selectedManualTest = useMemo(
    () => result?.manualTests.find((test) => test.id === selectedManualTestId) ?? result?.manualTests[0] ?? null,
    [result, selectedManualTestId]
  );
  const specFiles = useMemo(
    () => result?.files.filter((file) => file.path.startsWith("tests/") && file.path.endsWith(".spec.ts")) ?? [],
    [result]
  );
  const selectedSpec = useMemo(
    () => specFiles.find((file) => file.path === selectedSpecPath) ?? specFiles[0] ?? null,
    [specFiles, selectedSpecPath]
  );
  const filteredFiles = useMemo(() => {
    const normalized = fileSearch.trim().toLowerCase();
    const files = result?.files ?? [];
    if (!normalized) return files;
    return files.filter((file) => [file.path, file.purpose, file.language].join(" ").toLowerCase().includes(normalized));
  }, [fileSearch, result]);
  const selectedFile = useMemo<QaGeneratedFrameworkFile | null>(
    () => filteredFiles.find((file) => file.path === selectedFilePath) ?? filteredFiles[0] ?? null,
    [filteredFiles, selectedFilePath]
  );

  async function generateFramework() {
    if (!canGenerate) {
      setMessage("Enter a real target URL first. StatQA will analyze that site before generating runnable tests.");
      return;
    }

    setLoading(true);
    setMessage("Analyzing the live site with Playwright, asking AI for manual tests and automation blueprints, then compiling runnable specs...");

    const payload: QaFrameworkRequest = {
      ...form,
      applicationName: form.applicationName.trim() || new URL(form.applicationUrl).hostname.replace(/^www\./, ""),
      productDescription:
        form.productDescription.trim() ||
        "Public website QA coverage generated from observed pages, visible content, links, forms, and safe browser interactions.",
      mainRoles: splitLines(rolesText),
      criticalFlows: splitLines(flowsText),
      businessRules: splitLines(rulesText),
      riskAreas: splitLines(risksText),
      applicationUrl: form.applicationUrl.trim()
    };

    try {
      const response = await apiRequest<{ framework: FrameworkResult }>("/qa/framework/generate", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      setResult(response.framework);
      setSelectedManualTestId(response.framework.manualTests[0]?.id ?? "");
      const firstSpec = response.framework.files.find((file) => file.path.startsWith("tests/") && file.path.endsWith(".spec.ts"));
      setSelectedSpecPath(firstSpec?.path ?? "");
      setSelectedFilePath(response.framework.files[0]?.path ?? "");
      setArtifactView("evidence");
      setMessage(
        response.framework.validation.exportReady
          ? `Framework ready: analyzed ${response.framework.siteEvidence?.summary.pagesAnalyzed ?? 0} page(s), generated ${response.framework.manualTests.length} manual cases, and compiled ${response.framework.quality?.runnableSpecCount ?? 0} runnable spec file(s).`
          : "Framework generated but export is blocked until evidence or validation problems are fixed."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to generate the evidence-backed framework.");
    } finally {
      setLoading(false);
    }
  }

  async function downloadZip() {
    if (!result || !result.validation.exportReady) return;

    const zip = new JSZip();
    for (const file of result.files) {
      zip.file(file.path, file.content);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(`${slug(result.project.applicationName)}-playwright-framework.zip`, blob);
  }

  async function copySelectedSpec() {
    if (!selectedSpec) return;
    await navigator.clipboard.writeText(selectedSpec.content);
    setMessage(`Copied ${selectedSpec.path}.`);
  }

  async function copySelectedFile() {
    if (!selectedFile) return;
    await navigator.clipboard.writeText(selectedFile.content);
    setMessage(`Copied ${selectedFile.path}.`);
  }

  function downloadSelectedFile() {
    if (!selectedFile) return;
    const filename = selectedFile.path.split("/").at(-1) || "generated-file.txt";
    downloadBlob(filename, new Blob([selectedFile.content], { type: "text/plain" }));
  }

  return (
    <section className="panel qa-panel framework-builder">
      <div className="panel-header page-intro">
        <p className="eyebrow">AI evidence-backed framework builder</p>
        <h2>Generate a Playwright suite from the real site, not a demo template</h2>
        <p>
          StatQA now analyzes the submitted URL first, generates manual tests from observed evidence, asks AI for automation blueprints, and compiles those blueprints into readable Playwright code.
        </p>
      </div>

      {message ? <p className="info-banner">{message}</p> : null}

      <div className="workspace-flow-grid">
        <div className="workflow-sidebar">
          <div className="workflow-note">
            <span>1</span>
            <strong>Analyze the real site</strong>
            <p>Playwright collects pages, headings, text, links, buttons, forms, and safe public evidence.</p>
          </div>
          <div className="workflow-note">
            <span>2</span>
            <strong>Generate with AI</strong>
            <p>AI creates manual tests and selects automation blueprints only from observed evidence.</p>
          </div>
          <div className="workflow-note">
            <span>3</span>
            <strong>Compile runnable code</strong>
            <p>The backend compiles AI blueprints into stable Playwright TypeScript instead of trusting raw invented code.</p>
          </div>
        </div>

        <div className="workspace-main">
          <section className="subpanel">
            <div className="subpanel-heading">
              <h3>Target application</h3>
              <p>A real URL is required. The old fake demo framework path is intentionally removed.</p>
            </div>
            <div className="qa-form-grid">
              <label className="qa-field-wide">
                Application URL
                <input
                  value={form.applicationUrl}
                  onChange={(event) => setForm({ ...form, applicationUrl: event.target.value })}
                  placeholder="https://your-real-app.com"
                />
              </label>
              <label className="qa-field-wide">
                Application name
                <input
                  value={form.applicationName}
                  onChange={(event) => setForm({ ...form, applicationName: event.target.value })}
                  placeholder="Auto-filled from hostname if empty"
                />
              </label>
              <label className="qa-field-full">
                Product context
                <textarea
                  value={form.productDescription}
                  onChange={(event) => setForm({ ...form, productDescription: event.target.value })}
                  placeholder="What does the site do? What should QA care about?"
                />
              </label>
              <label>
                Roles
                <textarea value={rolesText} onChange={(event) => setRolesText(event.target.value)} />
              </label>
              <label>
                Critical flows
                <textarea value={flowsText} onChange={(event) => setFlowsText(event.target.value)} />
              </label>
              <label>
                Business rules
                <textarea value={rulesText} onChange={(event) => setRulesText(event.target.value)} />
              </label>
              <label>
                Risk areas
                <textarea value={risksText} onChange={(event) => setRisksText(event.target.value)} />
              </label>
            </div>
          </section>

          <section className="subpanel">
            <div className="subpanel-heading">
              <h3>Framework options</h3>
              <p>Runnable tests are evidence-backed. Risky private flows stay manual until the user provides safe configuration.</p>
            </div>
            <div className="qa-filter-row framework-options-row">
              {(["chromium", "firefox", "webkit"] as const).map((browser) => (
                <label key={browser} className="suite-toggle">
                  <input
                    type="checkbox"
                    checked={form.supportedBrowsers.includes(browser)}
                    onChange={(event) => {
                      const selected = event.target.checked
                        ? [...form.supportedBrowsers, browser]
                        : form.supportedBrowsers.filter((item) => item !== browser);
                      setForm({ ...form, supportedBrowsers: selected.length ? selected : [browser] });
                    }}
                  />
                  {browser}
                </label>
              ))}
              <label className="suite-toggle">
                <input type="checkbox" checked={form.includeCi} onChange={(event) => setForm({ ...form, includeCi: event.target.checked })} />
                GitHub Actions
              </label>
              <label className="suite-toggle">
                <input type="checkbox" checked={form.portfolioMode} onChange={(event) => setForm({ ...form, portfolioMode: event.target.checked })} />
                Portfolio docs
              </label>
            </div>
            <div className="actions-row">
              <button className="primary-button" type="button" disabled={!canGenerate} onClick={generateFramework}>
                {loading ? "Analyzing site and generating..." : "Analyze Site and Generate Framework"}
              </button>
              <button className="secondary-button" type="button" disabled={!result?.validation.exportReady} onClick={downloadZip}>
                Download Framework ZIP
              </button>
              <button className="secondary-button" type="button" disabled={!result} onClick={() => onNavigate("qa-run")}>
                Open QA runs
              </button>
            </div>
          </section>
        </div>
      </div>

      {result ? (
        <>
          <div className="test-summary-grid">
            <div><span>Readiness</span><strong>{result.quality?.readinessScore ?? 0}%</strong></div>
            <div><span>Pages analyzed</span><strong>{result.siteEvidence?.summary.pagesAnalyzed ?? 0}</strong></div>
            <div><span>Manual cases</span><strong>{result.manualTests.length}</strong></div>
            <div><span>Runnable specs</span><strong>{result.quality?.runnableSpecCount ?? specFiles.length}</strong></div>
            <div><span>Evidence assertions</span><strong>{result.quality?.evidenceBackedAssertions ?? 0}</strong></div>
            <div><span>Export</span><strong>{result.validation.exportReady ? "Ready" : "Blocked"}</strong></div>
          </div>

          <nav className="artifact-tabs" aria-label="Generated artifact workflow">
            {artifactViews.map((view) => (
              <button
                key={view.id}
                type="button"
                className={artifactView === view.id ? "artifact-tab active" : "artifact-tab"}
                onClick={() => setArtifactView(view.id)}
              >
                <strong>{view.label}</strong>
                <span>{view.description}</span>
              </button>
            ))}
          </nav>

          {artifactView === "evidence" ? (
            <section className="framework-section artifact-panel">
              <div className="subpanel-heading">
                <h3>Real site evidence</h3>
                <p>This is what StatQA observed before AI generated the tests. Automatic specs should only come from this evidence.</p>
              </div>
              <div className="test-summary-grid">
                <div><span>Status</span><strong>{result.siteEvidence?.status ?? "unknown"}</strong></div>
                <div><span>Forms</span><strong>{result.siteEvidence?.summary.formsFound ?? 0}</strong></div>
                <div><span>Inputs</span><strong>{result.siteEvidence?.summary.inputsFound ?? 0}</strong></div>
                <div><span>Buttons</span><strong>{result.siteEvidence?.summary.buttonsFound ?? 0}</strong></div>
                <div><span>Internal links</span><strong>{result.siteEvidence?.summary.internalLinksFound ?? 0}</strong></div>
              </div>
              {result.siteEvidence?.error ? <p className="error-banner">{result.siteEvidence.error}</p> : null}
              <div className="qa-list compact-framework-list">
                {result.siteEvidence?.pages.map((page) => (
                  <article className="test-row" key={page.url}>
                    <strong>{page.title || page.path}</strong>
                    <span>{page.status ?? "unknown"} - {shortUrl(page.url)}</span>
                    <p>Headings: {page.headings.map((item) => item.text).slice(0, 4).join(", ") || "none observed"}</p>
                    <p>Buttons: {page.buttons.map((item) => item.text).slice(0, 4).join(", ") || "none observed"}</p>
                    <p>Internal links: {page.links.filter((link) => link.internal).slice(0, 5).map((link) => link.text || shortUrl(link.href)).join(", ") || "none observed"}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {artifactView === "manual" ? (
            <section className="framework-section artifact-panel">
              <div className="subpanel-heading">
                <h3>Manual test grid</h3>
                <p>These are the human-readable source tests. Each one has priority, severity, evidence notes, and automation suitability.</p>
              </div>
              <ManualTestGrid tests={result.manualTests} selectedId={selectedManualTest?.id ?? ""} onSelect={setSelectedManualTestId} />
              <ManualTestDetail test={selectedManualTest} />
            </section>
          ) : null}

          {artifactView === "automation" ? (
            <section className="framework-section artifact-panel">
              <div className="subpanel-heading">
                <h3>Automatic tests with code</h3>
                <p>AI chooses the evidence-backed automation blueprints; StatQA compiles them into runnable Playwright TypeScript.</p>
              </div>
              <div className="automation-summary">
                <div className="summary-stat"><span>Automate</span><strong>{result.suitability.filter((item) => item.recommendation === "automate").length} cases</strong></div>
                <div className="summary-stat"><span>Runnable spec files</span><strong>{specFiles.length}</strong></div>
                <div className="summary-stat"><span>Average score</span><strong>{Math.round(result.suitability.reduce((sum, item) => sum + item.score, 0) / Math.max(result.suitability.length, 1))}%</strong></div>
              </div>

              <div className="framework-section framework-files">
                <div className="framework-file-list">
                  <h4>Spec files</h4>
                  {specFiles.map((file) => (
                    <button
                      key={file.path}
                      type="button"
                      className={selectedSpec?.path === file.path ? "sidebar-item active" : "sidebar-item"}
                      onClick={() => setSelectedSpecPath(file.path)}
                    >
                      {file.path}
                    </button>
                  ))}
                </div>
                <div className="framework-file-preview">
                  {selectedSpec ? (
                    <>
                      <div className="panel-header">
                        <h3>{selectedSpec.path}</h3>
                        <p>{selectedSpec.purpose}</p>
                      </div>
                      <div className="actions-row">
                        <button className="secondary-button" type="button" onClick={copySelectedSpec}>Copy code</button>
                      </div>
                      <pre className="qa-code-preview"><code>{selectedSpec.content}</code></pre>
                    </>
                  ) : <p className="qa-inline-status">No runnable specs were generated. Check validation and site evidence.</p>}
                </div>
              </div>

              <div className="qa-list compact-framework-list">
                <h4>Automation decisions</h4>
                {result.suitability.map((item) => (
                  <div className="test-row suitability-row" key={item.testCaseId}>
                    <strong>{item.testCaseId}: {item.recommendation}</strong>
                    <span>Score {item.score} - {item.recommendedAutomationLayer} - maintenance {item.maintenanceRisk}</span>
                    <p>Reasons: {item.reasons.join(", ")}</p>
                    {item.blockers.length ? <p className="qa-inline-status">Blockers: {item.blockers.join(", ")}</p> : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {artifactView === "files" ? (
            <section className="framework-section framework-files artifact-panel">
              <div className="framework-file-list">
                <h3>Generated files</h3>
                <label className="framework-file-search">
                  Search files
                  <input value={fileSearch} onChange={(event) => setFileSearch(event.target.value)} placeholder="README, spec, evidence, config..." />
                </label>
                {filteredFiles.map((file) => (
                  <button
                    key={file.path}
                    type="button"
                    className={selectedFile?.path === file.path ? "sidebar-item active" : "sidebar-item"}
                    onClick={() => setSelectedFilePath(file.path)}
                  >
                    {file.path}
                  </button>
                ))}
              </div>
              <div className="framework-file-preview">
                {selectedFile ? (
                  <>
                    <div className="panel-header">
                      <h3>{selectedFile.path}</h3>
                      <p>{selectedFile.purpose}</p>
                    </div>
                    <div className="actions-row">
                      <button className="secondary-button" type="button" onClick={copySelectedFile}>Copy file</button>
                      <button className="secondary-button" type="button" onClick={downloadSelectedFile}>Download file</button>
                    </div>
                    <pre className="qa-json-preview">{selectedFile.content}</pre>
                  </>
                ) : null}
              </div>
            </section>
          ) : null}

          {result.validation.blockingErrors.length || result.validation.warnings.length ? (
            <section className="settings-section">
              <h3>Validation</h3>
              {result.validation.blockingErrors.map((item) => <p className="error-banner" key={item}>{item}</p>)}
              {result.validation.warnings.map((item) => <p className="qa-inline-status" key={item}>{item}</p>)}
            </section>
          ) : null}
        </>
      ) : (
        <div className="empty-state qa-empty-state">
          Enter a real app URL, then generate. StatQA will analyze the site first and export only evidence-backed runnable tests.
        </div>
      )}
    </section>
  );
}
