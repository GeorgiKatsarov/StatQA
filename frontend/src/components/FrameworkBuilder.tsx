import { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import { apiRequest } from "../lib/api";
import type {
  QaFrameworkBuilderResult,
  QaFrameworkRequest,
  QaGeneratedFrameworkFile,
  QaManualFrameworkTest
} from "../lib/types";

const DEFAULT_REQUEST: QaFrameworkRequest = {
  applicationName: "TaskPilot",
  applicationUrl: "https://taskpilot.example.test",
  productDescription:
    "A web-based task management app where admins, managers, and contributors create projects, assign tasks, update statuses, and review dashboard progress.",
  mainRoles: ["Admin", "Manager", "Contributor"],
  criticalFlows: ["Login", "Create project", "Create task", "Assign task", "Filter dashboard"],
  businessRules: [
    "Contributors cannot delete projects",
    "Completed tasks require resolution notes",
    "Due dates cannot be in the past"
  ],
  riskAreas: ["Authentication", "Permissions", "Data persistence", "Form validation"],
  supportedBrowsers: ["chromium", "firefox", "webkit"],
  includeCi: true,
  portfolioMode: true
};

function splitLines(value: string): string[] {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function joinLines(value: string[]): string {
  return value.join("\n");
}

function downloadBlob(filename: string, blob: Blob) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "statqa-framework";
}

const artifactViews = [
  { id: "strategy", label: "Strategy", description: "Scope, risk, and assumptions" },
  { id: "manual", label: "Manual tests", description: "Human-executable QA cases" },
  { id: "automation", label: "Automatic tests", description: "What becomes Playwright code" },
  { id: "files", label: "Download suite", description: "Preview framework and export ZIP" }
] as const;

type ArtifactView = (typeof artifactViews)[number]["id"];

export function FrameworkBuilder({ defaultUrl, onNavigate }: { defaultUrl: string; onNavigate: (page: string) => void }) {
  const [form, setForm] = useState<QaFrameworkRequest>({
    ...DEFAULT_REQUEST,
    applicationUrl: defaultUrl || DEFAULT_REQUEST.applicationUrl
  });
  const [rolesText, setRolesText] = useState(joinLines(DEFAULT_REQUEST.mainRoles));
  const [flowsText, setFlowsText] = useState(joinLines(DEFAULT_REQUEST.criticalFlows));
  const [rulesText, setRulesText] = useState(joinLines(DEFAULT_REQUEST.businessRules));
  const [risksText, setRisksText] = useState(joinLines(DEFAULT_REQUEST.riskAreas));
  const [result, setResult] = useState<QaFrameworkBuilderResult | null>(null);
  const [selectedPath, setSelectedPath] = useState<string>("");
  const [fileSearch, setFileSearch] = useState("");
  const [artifactView, setArtifactView] = useState<ArtifactView>("strategy");
  const [selectedManualTestId, setSelectedManualTestId] = useState<string>("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const filteredFiles = useMemo(() => {
    const normalized = fileSearch.trim().toLowerCase();
    if (!result || !normalized) {
      return result?.files ?? [];
    }

    return result.files.filter((file) =>
      [file.path, file.purpose, file.language].join(" ").toLowerCase().includes(normalized)
    );
  }, [fileSearch, result]);

  const selectedFile = useMemo<QaGeneratedFrameworkFile | null>(
    () => result?.files.find((file) => file.path === selectedPath) ?? result?.files[0] ?? null,
    [result, selectedPath]
  );

  const selectedManualTest = useMemo<QaManualFrameworkTest | null>(
    () => result?.manualTests.find((test) => test.id === selectedManualTestId) ?? result?.manualTests[0] ?? null,
    [result, selectedManualTestId]
  );

  useEffect(() => {
    if (defaultUrl) {
      setForm((current) => ({ ...current, applicationUrl: defaultUrl }));
    }
  }, [defaultUrl]);

  async function generateFramework() {
    setLoading(true);
    setMessage("Generating framework and tests with AI...");
    const payload: QaFrameworkRequest = {
      ...form,
      mainRoles: splitLines(rolesText),
      criticalFlows: splitLines(flowsText),
      businessRules: splitLines(rulesText),
      riskAreas: splitLines(risksText)
    };

    try {
      const response = await apiRequest<{ framework: QaFrameworkBuilderResult }>("/qa/framework/generate", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setResult(response.framework);
      setSelectedPath(response.framework.files[0]?.path ?? "");
      setSelectedManualTestId(response.framework.manualTests[0]?.id ?? "");
      setArtifactView("strategy");
      setMessage(
        response.framework.validation.exportReady
          ? `✓ Framework generated and ready to export with ${response.framework.manualTests.length} manual tests and ${response.framework.suitability.filter((item) => item.recommendation === "automate").length} automated candidates.`
          : "Framework generated with blocking validation issues."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to generate framework.");
    } finally {
      setLoading(false);
    }
  }

  async function downloadZip() {
    if (!result) {
      return;
    }

    const zip = new JSZip();
    for (const file of result.files) {
      zip.file(file.path, file.content);
    }
    zip.file(
      "statqa-framework-manifest.json",
      JSON.stringify(
        {
          projectName: result.project.applicationName,
          generatedAt: result.generatedAt,
          fileCount: result.files.length,
          manualTests: result.manualTests.length,
          automatedCandidates: result.suitability.filter((item) => item.recommendation === "automate").length,
          assumptions: result.testStrategy.assumptions,
          validation: result.validation
        },
        null,
        2
      )
    );

    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(`${slug(result.project.applicationName)}-playwright-framework.zip`, blob);
  }

  async function copySelectedFile() {
    if (!selectedFile) {
      return;
    }

    await navigator.clipboard.writeText(selectedFile.content);
    setMessage(`Copied ${selectedFile.path} to clipboard.`);
  }

  function downloadSelectedFile() {
    if (!selectedFile) {
      return;
    }

    const filename = selectedFile.path.split("/").at(-1) || "generated-file.txt";
    downloadBlob(filename, new Blob([selectedFile.content], { type: "text/plain" }));
  }

  return (
    <section className="panel qa-panel framework-builder">
      <div className="panel-header page-intro">
        <p className="eyebrow">Step 2 - Automatic tests</p>
        <h2>Create the Playwright test suite</h2>
        <p>
          Convert reviewed manual test cases into automation decisions, Playwright TypeScript files, documentation, and a downloadable framework ZIP.
        </p>
      </div>

      {message ? <p className="info-banner">{message}</p> : null}

      <div className="workspace-flow-grid">
        <div className="workflow-sidebar">
          <div className="workflow-note">
            <span>1</span>
            <strong>Describe the app</strong>
            <p>Roles, flows, rules, and risks become manual tests and automation notes.</p>
          </div>
          <div className="workflow-note">
            <span>2</span>
            <strong>Choose output</strong>
            <p>Select browsers, CI, and portfolio docs before generating automatic tests.</p>
          </div>
          <div className="workflow-note">
            <span>3</span>
            <strong>Preview before export</strong>
            <p>Inspect generated specs and support files before downloading the suite.</p>
          </div>
        </div>

        <div className="workspace-main">
          <section className="subpanel">
            <div className="subpanel-heading">
              <h3>Application context</h3>
              <p>This context drives manual tests, automation suitability, and framework docs.</p>
            </div>
            <div className="qa-form-grid">
              <label className="qa-field-wide">
                Application name
                <input value={form.applicationName} onChange={(event) => setForm({ ...form, applicationName: event.target.value })} />
              </label>
              <label className="qa-field-wide">
                Application URL
                <input value={form.applicationUrl} onChange={(event) => setForm({ ...form, applicationUrl: event.target.value })} />
              </label>
              <label className="qa-field-full">
                Product description
                <textarea
                  value={form.productDescription}
                  onChange={(event) => setForm({ ...form, productDescription: event.target.value })}
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
              <p>Generate a practical Playwright TypeScript suite with reporting, docs, and selected browsers.</p>
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
                <input
                  type="checkbox"
                  checked={form.portfolioMode}
                  onChange={(event) => setForm({ ...form, portfolioMode: event.target.checked })}
                />
                Portfolio mode
              </label>
            </div>
            <div className="actions-row">
              <button className="primary-button" type="button" disabled={loading} onClick={generateFramework}>
                {loading ? "Generating framework with AI..." : "Generate Framework"}
              </button>
              <button className="secondary-button" type="button" disabled={!result?.validation.exportReady} onClick={downloadZip}>
                Download Framework ZIP
              </button>
              <button className="secondary-button" type="button" disabled={!result} onClick={() => onNavigate("qa-run")}>
                Test the Framework
              </button>
            </div>
          </section>
        </div>
      </div>

      {result ? (
        <>
          <div className="test-summary-grid">
            <div><span>Manual tests</span><strong>{result.manualTests.length}</strong></div>
            <div><span>Automate</span><strong>{result.suitability.filter((item) => item.recommendation === "automate").length}</strong></div>
            <div><span>Files</span><strong>{result.files.length}</strong></div>
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

          {artifactView === "strategy" ? (
            <section className="framework-section artifact-panel">
              <div className="subpanel-heading">
                <h3>Test strategy</h3>
                <p>Use this as the QA rationale before generating or running automation.</p>
              </div>
              <div className="artifact-two-column">
                <div>
                  <h4>Objectives</h4>
                  <ul>
                    {result.testStrategy.objectives.map((objective) => <li key={objective}>{objective}</li>)}
                  </ul>
                  <h4>Automation focus</h4>
                  <ul>
                    {result.testStrategy.automationFocus.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
                <div>
                  <h4>Risk priorities</h4>
                  <ul>
                    {result.testStrategy.riskPriorities.map((risk) => <li key={risk}>{risk}</li>)}
                  </ul>
                  <h4>Assumptions</h4>
                  <ul>
                    {result.testStrategy.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}
                  </ul>
                </div>
              </div>
            </section>
          ) : null}

          {artifactView === "manual" ? (
            <section className="framework-section artifact-panel">
              <div className="subpanel-heading">
                <h3>Manual Test Cases</h3>
                <p>These cases are written for human execution. Review them before automating similar flows.</p>
              </div>
              <div className="manual-test-grid">
                {result.manualTests.map((test) => (
                  <button
                    key={test.id}
                    type="button"
                    className={`manual-test-card ${selectedManualTest?.id === test.id ? "active" : ""}`}
                    onClick={() => setSelectedManualTestId(test.id)}
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
              {selectedManualTest ? (
                <article className="manual-test-detail">
                  <div className="issue-head">
                    <span className="category-badge">{selectedManualTest.id}</span>
                    <span className={`severity severity-${selectedManualTest.priority === "critical" ? "critical" : selectedManualTest.priority === "high" ? "error" : "info"}`}>
                      {selectedManualTest.priority}
                    </span>
                    <span className="category-badge">{selectedManualTest.automationSuitability}</span>
                  </div>
                  <h3>{selectedManualTest.title}</h3>
                  <p>{selectedManualTest.objective}</p>
                  <div className="artifact-two-column">
                    <div>
                      <h4>Preconditions</h4>
                      <ul>{selectedManualTest.preconditions.map((item) => <li key={item}>{item}</li>)}</ul>
                    </div>
                    <div>
                      <h4>Test Data</h4>
                      <ul>{selectedManualTest.testData.map((item) => <li key={item}>{item}</li>)}</ul>
                    </div>
                  </div>
                  <h4>Steps and Expected Results</h4>
                  <ol className="manual-step-list">
                    {selectedManualTest.steps.map((step) => (
                      <li key={`${selectedManualTest.id}-${step.action}`}>
                        <strong>{step.action}</strong>
                        <span>{step.expectedResult}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="qa-inline-status"><strong>Automation Notes:</strong> {selectedManualTest.automationNotes}</p>
                </article>
              ) : null}
            </section>
          ) : null}

          {artifactView === "automation" ? (
            <section className="framework-section artifact-panel">
              <div className="subpanel-heading">
                <h3>Automatic Test Code</h3>
                <p>AI-generated Playwright tests for recommended automation candidates. Review and customize before running.</p>
              </div>
              <div className="automation-test-view">
                <div className="automation-summary">
                  <div className="summary-stat">
                    <span>Automate</span>
                    <strong>{result.suitability.filter((item) => item.recommendation === "automate").length} tests</strong>
                  </div>
                  <div className="summary-stat">
                    <span>Automation Score</span>
                    <strong>{Math.round(result.suitability.filter((item) => item.recommendation === "automate").reduce((sum, item) => sum + item.score, 0) / Math.max(result.suitability.filter((item) => item.recommendation === "automate").length, 1))}%</strong>
                  </div>
                  <div className="summary-stat">
                    <span>Average Maintenance</span>
                    <strong>{result.suitability[0]?.maintenanceRisk ?? "medium"}</strong>
                  </div>
                </div>

                {result.files
                  .filter((f) => f.path.includes("/tests/") && f.path.endsWith(".spec.ts"))
                  .map((specFile) => (
                    <div key={specFile.path} className="spec-file-view">
                      <h4>{specFile.path}</h4>
                      <p className="spec-purpose">{specFile.purpose}</p>
                      <pre className="qa-code-preview"><code>{specFile.content}</code></pre>
                    </div>
                  ))}
              </div>

              <div className="qa-list compact-framework-list">
                <h4>Automation Suitability Analysis</h4>
                {result.suitability.map((item) => (
                  <div className="test-row suitability-row" key={item.testCaseId}>
                    <strong>{item.testCaseId}: {item.recommendation}</strong>
                    <span>Score {item.score} - {item.recommendedAutomationLayer} - maintenance {item.maintenanceRisk}</span>
                    <p>Reasons: {item.reasons.join(", ")}</p>
                    <p>Test data: {item.testDataNeeds.join(", ")}</p>
                    <p>Selector assumptions: {item.selectorAssumptions.join(", ")}</p>
                    {item.blockers.length ? <p className="qa-inline-status">⚠ Blockers: {item.blockers.join(", ")}</p> : null}
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
                  <input value={fileSearch} onChange={(event) => setFileSearch(event.target.value)} placeholder="README, spec, config..." />
                </label>
                {filteredFiles.map((file) => (
                  <button
                    key={file.path}
                    type="button"
                    className={selectedFile?.path === file.path ? "sidebar-item active" : "sidebar-item"}
                    onClick={() => setSelectedPath(file.path)}
                  >
                    {file.path}
                  </button>
                ))}
                {!filteredFiles.length ? <p className="qa-inline-status">No files match this search.</p> : null}
              </div>
              <div className="framework-file-preview">
                {selectedFile ? (
                  <>
                    <div className="panel-header">
                      <h3>{selectedFile.path}</h3>
                      <p>{selectedFile.purpose}</p>
                    </div>
                    <div className="actions-row">
                      <button className="secondary-button" type="button" onClick={copySelectedFile}>
                        Copy file
                      </button>
                      <button className="secondary-button" type="button" onClick={downloadSelectedFile}>
                        Download file
                      </button>
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
          Load the TaskPilot demo or enter your own app context, then generate the framework preview.
        </div>
      )}
    </section>
  );
}
