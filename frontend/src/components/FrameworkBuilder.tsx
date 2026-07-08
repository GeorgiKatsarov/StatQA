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

type FrameworkRunResult = {
  status: "passed" | "failed";
  startedAt: string;
  finishedAt: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
  checks: Array<{
    title: string;
    path: string;
    status: "passed" | "failed";
    durationMs: number;
    message: string;
  }>;
};

const EMPTY_REQUEST: QaFrameworkRequest = {
  applicationName: "",
  applicationUrl: "",
  productDescription: "",
  mainRoles: [],
  criticalFlows: [],
  businessRules: [],
  riskAreas: [],
  supportedBrowsers: ["chromium", "firefox", "webkit"],
  includeCi: true,
  portfolioMode: true
};

function splitLines(value: string): string[] {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
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

function shortUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.pathname}${url.search}` || "/";
  } catch {
    return value;
  }
}

function downloadBlob(filename: string, blob: Blob) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
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

export function FrameworkBuilder({ defaultUrl }: { defaultUrl: string; onNavigate: (page: string) => void }) {
  const [form, setForm] = useState<QaFrameworkRequest>({ ...EMPTY_REQUEST, applicationUrl: defaultUrl || "" });
  const [rolesText, setRolesText] = useState("");
  const [flowsText, setFlowsText] = useState("");
  const [rulesText, setRulesText] = useState("");
  const [risksText, setRisksText] = useState("");
  const [result, setResult] = useState<FrameworkResult | null>(null);
  const [runResult, setRunResult] = useState<FrameworkRunResult | null>(null);
  const [selectedManualTestId, setSelectedManualTestId] = useState("");
  const [selectedFilePath, setSelectedFilePath] = useState("");
  const [fileSearch, setFileSearch] = useState("tests/generated");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (defaultUrl && !form.applicationUrl) {
      setForm((current) => ({ ...current, applicationUrl: defaultUrl }));
    }
  }, [defaultUrl, form.applicationUrl]);

  const roles = useMemo(() => splitLines(rolesText), [rolesText]);
  const flows = useMemo(() => splitLines(flowsText), [flowsText]);
  const rules = useMemo(() => splitLines(rulesText), [rulesText]);
  const risks = useMemo(() => splitLines(risksText), [risksText]);

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!isValidUrl(form.applicationUrl.trim())) errors.push("Enter a valid public application URL.");
    if (form.applicationName.trim().length < 3) errors.push("Application name must be at least 3 characters.");
    if (form.productDescription.trim().length < 40) errors.push("Product context must explain what the app does and what QA should protect.");
    if (!roles.length) errors.push("Add at least one user role/persona.");
    if (flows.length < 2) errors.push("Add at least two critical flows.");
    if (!rules.length) errors.push("Add at least one business rule.");
    if (risks.length < 2) errors.push("Add at least two risk areas.");
    if (!form.supportedBrowsers.length) errors.push("Select at least one browser.");
    return errors;
  }, [flows.length, form.applicationName, form.applicationUrl, form.productDescription, form.supportedBrowsers.length, risks.length, roles.length, rules.length]);

  const canGenerate = validationErrors.length === 0 && !loading && !running;
  const selectedManualTest = useMemo(
    () => result?.manualTests.find((test) => test.id === selectedManualTestId) ?? result?.manualTests[0] ?? null,
    [result, selectedManualTestId]
  );
  const specFiles = useMemo(
    () => result?.files.filter((file) => file.path.startsWith("tests/generated") && file.path.endsWith(".spec.ts")) ?? [],
    [result]
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

  function buildPayload(): QaFrameworkRequest {
    return {
      ...form,
      applicationName: form.applicationName.trim(),
      applicationUrl: form.applicationUrl.trim(),
      productDescription: form.productDescription.trim(),
      mainRoles: roles,
      criticalFlows: flows,
      businessRules: rules,
      riskAreas: risks,
      supportedBrowsers: form.supportedBrowsers
    };
  }

  async function generateFramework() {
    if (!canGenerate) {
      setMessage("Complete the required product context before generation. A serious framework needs serious input.");
      return;
    }

    setLoading(true);
    setRunResult(null);
    setMessage("Building the full framework. This can be slow: StatQA analyzes the live site, asks AI for QA design, and compiles POM-based Playwright tests...");

    try {
      const response = await apiRequest<{ framework: FrameworkResult }>("/qa/framework/generate", {
        method: "POST",
        body: JSON.stringify(buildPayload())
      });

      setResult(response.framework);
      setSelectedManualTestId(response.framework.manualTests[0]?.id ?? "");
      const firstSpec = response.framework.files.find((file) => file.path.startsWith("tests/generated") && file.path.endsWith(".spec.ts"));
      setSelectedFilePath(firstSpec?.path ?? response.framework.files[0]?.path ?? "");
      setFileSearch("tests/generated");
      setMessage(
        response.framework.validation.exportReady
          ? `Framework ready: ${response.framework.files.length} files, ${response.framework.manualTests.length} manual cases, ${response.framework.files.filter((file) => file.path.endsWith(".spec.ts")).length} spec files.`
          : "Framework generated but export is blocked until validation problems are fixed."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to generate the framework.");
    } finally {
      setLoading(false);
    }
  }

  async function runGeneratedFramework() {
    if (!canGenerate) {
      setMessage("Complete the required product context before running framework checks.");
      return;
    }

    setRunning(true);
    setMessage("Running generated browser checks from StatQA. This may take a while because Playwright is opening the real site...");

    try {
      const response = await apiRequest<{ framework: FrameworkResult; run: FrameworkRunResult }>("/qa/framework/run", {
        method: "POST",
        body: JSON.stringify(buildPayload())
      });
      setResult(response.framework);
      setRunResult(response.run);
      setSelectedManualTestId(response.framework.manualTests[0]?.id ?? "");
      const firstSpec = response.framework.files.find((file) => file.path.startsWith("tests/generated") && file.path.endsWith(".spec.ts"));
      setSelectedFilePath(firstSpec?.path ?? response.framework.files[0]?.path ?? "");
      setMessage(`Framework run ${response.run.status}: ${response.run.summary.passed}/${response.run.summary.total} checks passed.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to run generated framework checks.");
    } finally {
      setRunning(false);
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

  async function copySelectedFile() {
    if (!selectedFile) return;
    await navigator.clipboard.writeText(selectedFile.content);
    setMessage(`Copied ${selectedFile.path}.`);
  }

  return (
    <section className="panel qa-panel framework-builder">
      <div className="panel-header page-intro">
        <p className="eyebrow">Full E2E framework builder</p>
        <h2>Generate one serious Playwright TypeScript framework</h2>
        <p>
          Fill the product context, let StatQA analyze the real site slowly, generate a POM-based framework, run the generated browser checks here, then download the ZIP.
        </p>
      </div>

      {message ? <p className="info-banner">{message}</p> : null}

      <section className="subpanel">
        <div className="subpanel-heading">
          <h3>Required product context</h3>
          <p>Generation is disabled until the URL and QA context are specific enough to produce a real automation framework.</p>
        </div>
        <div className="qa-form-grid">
          <label className="qa-field-wide">
            Application URL
            <input value={form.applicationUrl} onChange={(event) => setForm({ ...form, applicationUrl: event.target.value })} placeholder="https://your-real-app.com" />
          </label>
          <label className="qa-field-wide">
            Application name
            <input value={form.applicationName} onChange={(event) => setForm({ ...form, applicationName: event.target.value })} placeholder="QACloud Dev" />
          </label>
          <label className="qa-field-full">
            Product context
            <textarea value={form.productDescription} onChange={(event) => setForm({ ...form, productDescription: event.target.value })} placeholder="Explain what the product does, main user value, risky areas, and what QA must protect." />
          </label>
          <label>
            User roles / personas
            <textarea value={rolesText} onChange={(event) => setRolesText(event.target.value)} placeholder={"Visitor\nRegistered user\nAdmin"} />
          </label>
          <label>
            Critical flows
            <textarea value={flowsText} onChange={(event) => setFlowsText(event.target.value)} placeholder={"Open landing page and navigate core pages\nUse public forms safely\nVerify important content remains visible"} />
          </label>
          <label>
            Business rules
            <textarea value={rulesText} onChange={(event) => setRulesText(event.target.value)} placeholder={"Public pages must load without errors\nForms must not be destructive without confirmation"} />
          </label>
          <label>
            Risk areas
            <textarea value={risksText} onChange={(event) => setRisksText(event.target.value)} placeholder={"Broken navigation\nMissing content\nForm regression\nCross-browser rendering"} />
          </label>
        </div>

        {validationErrors.length ? (
          <div className="qa-list compact-framework-list">
            {validationErrors.map((error) => <p className="qa-inline-status" key={error}>{error}</p>)}
          </div>
        ) : <p className="qa-source-banner qa-source-ready">Context looks strong enough for framework generation.</p>}
      </section>

      <section className="subpanel">
        <div className="subpanel-heading">
          <h3>Framework options</h3>
          <p>The output follows strict POM guidelines, uses generated evidence fixtures, and separates specs from page objects.</p>
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
            {loading ? "Generating full framework..." : "Generate full E2E framework"}
          </button>
          <button className="secondary-button" type="button" disabled={!canGenerate || running} onClick={runGeneratedFramework}>
            {running ? "Running tests..." : "Run generated tests from site"}
          </button>
          <button className="secondary-button" type="button" disabled={!result?.validation.exportReady} onClick={downloadZip}>
            Download Framework ZIP
          </button>
        </div>
      </section>

      {runResult ? (
        <section className="subpanel">
          <div className="subpanel-heading">
            <h3>Run result: {runResult.status}</h3>
            <p>{runResult.summary.passed}/{runResult.summary.total} checks passed. These checks open the real public pages from the generated framework evidence.</p>
          </div>
          <div className="qa-list compact-framework-list">
            {runResult.checks.map((check) => (
              <article className="test-row" key={`${check.title}-${check.path}`}>
                <strong>{check.title}</strong>
                <span>{check.status} - {check.durationMs} ms - {shortUrl(check.path)}</span>
                <p>{check.message}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {result ? (
        <>
          <div className="test-summary-grid">
            <div><span>Readiness</span><strong>{result.quality?.readinessScore ?? 0}%</strong></div>
            <div><span>Pages analyzed</span><strong>{result.siteEvidence?.summary.pagesAnalyzed ?? 0}</strong></div>
            <div><span>Manual cases</span><strong>{result.manualTests.length}</strong></div>
            <div><span>Spec files</span><strong>{specFiles.length}</strong></div>
            <div><span>Framework files</span><strong>{result.files.length}</strong></div>
            <div><span>Export</span><strong>{result.validation.exportReady ? "Ready" : "Blocked"}</strong></div>
          </div>

          <section className="framework-section artifact-panel">
            <div className="subpanel-heading">
              <h3>Generated manual tests</h3>
              <p>Source QA cases produced before automation. Automation is built from this evidence and the observed site.</p>
            </div>
            <ManualTestGrid tests={result.manualTests} selectedId={selectedManualTest?.id ?? ""} onSelect={setSelectedManualTestId} />
            <ManualTestDetail test={selectedManualTest} />
          </section>

          <section className="framework-section framework-files artifact-panel">
            <div className="framework-file-list">
              <h3>Generated framework files</h3>
              <label className="framework-file-search">
                Search files
                <input value={fileSearch} onChange={(event) => setFileSearch(event.target.value)} placeholder="tests/generated, pages, README, guidelines..." />
              </label>
              {filteredFiles.map((file) => (
                <button key={file.path} type="button" className={selectedFile?.path === file.path ? "sidebar-item active" : "sidebar-item"} onClick={() => setSelectedFilePath(file.path)}>
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
                  </div>
                  <pre className="qa-json-preview">{selectedFile.content}</pre>
                </>
              ) : null}
            </div>
          </section>

          <details className="settings-section">
            <summary>Advanced site evidence and validation</summary>
            <div className="test-summary-grid">
              <div><span>Status</span><strong>{result.siteEvidence?.status ?? "unknown"}</strong></div>
              <div><span>Forms</span><strong>{result.siteEvidence?.summary.formsFound ?? 0}</strong></div>
              <div><span>Inputs</span><strong>{result.siteEvidence?.summary.inputsFound ?? 0}</strong></div>
              <div><span>Buttons</span><strong>{result.siteEvidence?.summary.buttonsFound ?? 0}</strong></div>
              <div><span>Internal links</span><strong>{result.siteEvidence?.summary.internalLinksFound ?? 0}</strong></div>
            </div>
            {result.siteEvidence?.error ? <p className="error-banner">{result.siteEvidence.error}</p> : null}
            {result.validation.blockingErrors.map((item) => <p className="error-banner" key={item}>{item}</p>)}
            {result.validation.warnings.map((item) => <p className="qa-inline-status" key={item}>{item}</p>)}
            <div className="qa-list compact-framework-list">
              {result.siteEvidence?.pages.map((page) => (
                <article className="test-row" key={page.url}>
                  <strong>{page.title || page.path}</strong>
                  <span>{page.status ?? "unknown"} - {shortUrl(page.url)}</span>
                  <p>Headings: {page.headings.map((item) => item.text).slice(0, 4).join(", ") || "none observed"}</p>
                  <p>Buttons: {page.buttons.map((item) => item.text).slice(0, 4).join(", ") || "none observed"}</p>
                </article>
              ))}
            </div>
          </details>
        </>
      ) : (
        <div className="empty-state qa-empty-state">
          Fill all required context to generate a slow, complete, POM-based Playwright framework.
        </div>
      )}
    </section>
  );
}
