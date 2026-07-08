import { useMemo, useState } from "react";
import { apiRequest } from "../lib/api";
import type { QaGeneratedTest, QaGenerationMeta } from "../lib/types";

type ManualPriority = "Critical" | "High" | "Medium" | "Low";
type ManualStatus = "Draft" | "Ready" | "Needs Review" | "Approved";

type ManualCase = {
  id: string;
  module: string;
  title: string;
  preconditions: string;
  steps: string;
  expectedResult: string;
  priority: ManualPriority;
  type: string;
  status: ManualStatus;
  testData: string;
};

type AiGenerationResponse = {
  tests: QaGeneratedTest[];
  meta: QaGenerationMeta;
};

const SEED_CASES: ManualCase[] = [
  {
    id: "TC-MAN-001",
    module: "Authentication",
    title: "User can open the login page from public navigation",
    preconditions: "Application is reachable and public navigation is visible.",
    steps: "1. Open the home page\n2. Locate the login/sign-in entry point\n3. Open the login page",
    expectedResult: "The login page opens without client or server errors and shows username/password inputs.",
    priority: "High",
    type: "Smoke",
    status: "Ready",
    testData: "No account required"
  },
  {
    id: "TC-MAN-002",
    module: "Forms",
    title: "Required fields show validation when submitted empty",
    preconditions: "A public form is available and submission is non-destructive.",
    steps: "1. Open the target form\n2. Leave required fields empty\n3. Submit the form",
    expectedResult: "Validation messages are visible and no invalid data is accepted.",
    priority: "Critical",
    type: "Negative",
    status: "Ready",
    testData: "Empty values"
  },
  {
    id: "TC-MAN-003",
    module: "Navigation",
    title: "Core public pages remain reachable from main navigation",
    preconditions: "Application has public navigation links.",
    steps: "1. Open the home page\n2. Visit each main navigation link\n3. Return to the home page",
    expectedResult: "Each page loads successfully and displays meaningful content.",
    priority: "High",
    type: "Regression",
    status: "Ready",
    testData: "Public URLs"
  }
];

const EMPTY_FORM: ManualCase = {
  id: "",
  module: "",
  title: "",
  preconditions: "",
  steps: "",
  expectedResult: "",
  priority: "Medium",
  type: "Functional",
  status: "Draft",
  testData: ""
};

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

function csvEscape(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function nextManualId(count: number) {
  return `TC-MAN-${String(count + 1).padStart(3, "0")}`;
}

function titlePriority(priority: QaGeneratedTest["priority"]): ManualPriority {
  if (priority === "critical") return "Critical";
  if (priority === "high") return "High";
  if (priority === "low") return "Low";
  return "Medium";
}

function generatedToManualCase(test: QaGeneratedTest, index: number, batchId: string): ManualCase {
  const testData = test.testData && Object.keys(test.testData).length ? JSON.stringify(test.testData, null, 2) : "Generated from AI context; define exact data before execution.";
  return {
    id: `TC-AI-${batchId}-${String(index + 1).padStart(2, "0")}`,
    module: test.riskArea || test.testType || "Generated coverage",
    title: test.title,
    preconditions: test.sourceContext || "Target application is available and the tester has the required access.",
    steps: test.steps.map((step, stepIndex) => `${stepIndex + 1}. ${step}`).join("\n"),
    expectedResult: test.assertions.join("\n"),
    priority: titlePriority(test.priority),
    type: test.testType,
    status: "Ready",
    testData
  };
}

function toCsv(cases: ManualCase[]) {
  const headers = ["ID", "Module", "Title", "Preconditions", "Steps", "Expected Result", "Priority", "Type", "Status", "Test Data"];
  const rows = cases.map((testCase) => [
    testCase.id,
    testCase.module,
    testCase.title,
    testCase.preconditions,
    testCase.steps,
    testCase.expectedResult,
    testCase.priority,
    testCase.type,
    testCase.status,
    testCase.testData
  ].map(csvEscape).join(","));
  return [headers.map(csvEscape).join(","), ...rows].join("\n");
}

function toMarkdown(cases: ManualCase[]) {
  return [
    "# Manual Test Cases",
    "",
    ...cases.flatMap((testCase) => [
      `## ${testCase.id}: ${testCase.title}`,
      "",
      `- Module: ${testCase.module}`,
      `- Priority: ${testCase.priority}`,
      `- Type: ${testCase.type}`,
      `- Status: ${testCase.status}`,
      "",
      "### Preconditions",
      testCase.preconditions,
      "",
      "### Steps",
      testCase.steps,
      "",
      "### Expected Result",
      testCase.expectedResult,
      "",
      "### Test Data",
      testCase.testData,
      ""
    ])
  ].join("\n");
}

function toDocHtml(cases: ManualCase[]) {
  const rows = cases.map((testCase) => `
    <tr>
      <td>${escapeHtml(testCase.id)}</td>
      <td>${escapeHtml(testCase.module)}</td>
      <td>${escapeHtml(testCase.title)}</td>
      <td>${escapeHtml(testCase.priority)}</td>
      <td>${escapeHtml(testCase.type)}</td>
      <td>${escapeHtml(testCase.status)}</td>
      <td><pre>${escapeHtml(testCase.steps)}</pre></td>
      <td><pre>${escapeHtml(testCase.expectedResult)}</pre></td>
      <td><pre>${escapeHtml(testCase.testData)}</pre></td>
    </tr>
  `).join("");
  return `<html><head><meta charset="utf-8"><title>Manual Test Cases</title><style>body{font-family:Arial,sans-serif}table{border-collapse:collapse;width:100%}th,td{border:1px solid #cfd8e3;padding:8px;vertical-align:top}th{background:#eef2ff;text-align:left}pre{white-space:pre-wrap;font-family:Arial,sans-serif;margin:0}</style></head><body><h1>Manual Test Cases</h1><p>Generated by StatQA Manual Test Studio.</p><table><thead><tr><th>ID</th><th>Module</th><th>Title</th><th>Priority</th><th>Type</th><th>Status</th><th>Steps</th><th>Expected Result</th><th>Test Data</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

function makePdfText(title: string, body: string) {
  const safeLines = `${title}\n\n${body}`.replace(/[()\\]/g, " ").split("\n").filter(Boolean).slice(0, 45);
  const text = safeLines.map((line, index) => `BT /F1 10 Tf 40 ${760 - index * 16} Td (${line.slice(0, 95)}) Tj ET`).join("\n");
  return `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj
4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
5 0 obj << /Length ${text.length} >> stream
${text}
endstream endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000059 00000 n 
0000000116 00000 n 
0000000251 00000 n 
0000000321 00000 n 
trailer << /Root 1 0 R /Size 6 >>
startxref
${420 + text.length}
%%EOF`;
}

export function ManualTestStudio() {
  const [cases, setCases] = useState<ManualCase[]>(SEED_CASES);
  const [form, setForm] = useState<ManualCase>({ ...EMPTY_FORM, id: nextManualId(SEED_CASES.length) });
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(SEED_CASES[0]?.id ?? "");
  const [targetUrl, setTargetUrl] = useState("");
  const [projectName, setProjectName] = useState("Manual test workspace");
  const [riskContext, setRiskContext] = useState("Authentication, forms, navigation, validation, content, and regression risks");
  const [pageContext, setPageContext] = useState("");
  const [testCount, setTestCount] = useState(6);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [lastMeta, setLastMeta] = useState<QaGenerationMeta | null>(null);

  const aiValidationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!isValidHttpUrl(targetUrl.trim())) errors.push("Enter a valid http or https target URL for AI generation.");
    if (riskContext.trim().length < 10) errors.push("Risk context must describe the flows or risks you want covered.");
    if (!Number.isInteger(testCount) || testCount < 1 || testCount > 30) errors.push("Test count must be between 1 and 30 for a reviewable manual suite.");
    return errors;
  }, [riskContext, targetUrl, testCount]);

  const formValidationErrors = useMemo(() => {
    const errors: string[] = [];
    if (form.id.trim().length < 3) errors.push("Manual test ID is required.");
    if (form.title.trim().length < 5) errors.push("Title must describe the behavior under test.");
    if (form.steps.trim().length < 10) errors.push("Steps must include enough detail for another tester to execute them.");
    if (form.expectedResult.trim().length < 10) errors.push("Expected result must be specific and verifiable.");
    return errors;
  }, [form]);

  const filteredCases = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return cases;
    return cases.filter((testCase) => Object.values(testCase).join(" ").toLowerCase().includes(normalized));
  }, [cases, query]);
  const selectedCase = cases.find((testCase) => testCase.id === selectedId) ?? filteredCases[0];

  async function generateAiCases() {
    if (aiValidationErrors.length) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await apiRequest<AiGenerationResponse>("/qa/tests/generate", {
        method: "POST",
        body: JSON.stringify({
          targetUrl: targetUrl.trim(),
          projectName: projectName.trim() || "Manual test workspace",
          riskContext: riskContext.trim(),
          pageContext: pageContext.trim() || undefined,
          count: testCount
        })
      });
      const batchId = String(Date.now()).slice(-6);
      const generatedCases = response.tests.map((test, index) => generatedToManualCase(test, index, batchId));
      setCases((current) => [...generatedCases, ...current]);
      setSelectedId(generatedCases[0]?.id ?? selectedId);
      setLastMeta(response.meta);
      setMessage(`Generated ${generatedCases.length} AI manual test cases. Review them in the grid before exporting or automating.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to generate AI manual tests.");
    } finally {
      setLoading(false);
    }
  }

  function saveCase() {
    if (formValidationErrors.length) return;
    const cleanedForm = {
      ...form,
      id: form.id.trim(),
      module: form.module.trim() || "General",
      title: form.title.trim(),
      preconditions: form.preconditions.trim() || "No special preconditions.",
      steps: form.steps.trim(),
      expectedResult: form.expectedResult.trim(),
      testData: form.testData.trim() || "No specific test data."
    };
    setCases((current) => {
      const exists = current.some((testCase) => testCase.id === cleanedForm.id);
      return exists ? current.map((testCase) => testCase.id === cleanedForm.id ? cleanedForm : testCase) : [cleanedForm, ...current];
    });
    setSelectedId(cleanedForm.id);
    setForm({ ...EMPTY_FORM, id: nextManualId(cases.length + 1) });
  }

  function editCase(testCase: ManualCase) {
    setForm(testCase);
    setSelectedId(testCase.id);
  }

  function deleteCase(id: string) {
    setCases((current) => current.filter((testCase) => testCase.id !== id));
    if (selectedId === id) setSelectedId("");
  }

  function exportCases(format: "json" | "csv" | "xlsx" | "md" | "doc" | "pdf") {
    const source = filteredCases.length ? filteredCases : cases;
    if (format === "json") downloadText("manual-test-cases.json", JSON.stringify(source, null, 2), "application/json");
    if (format === "csv") downloadText("manual-test-cases.csv", toCsv(source), "text/csv");
    if (format === "xlsx") downloadText("manual-test-cases-excel.csv", toCsv(source), "application/vnd.ms-excel");
    if (format === "md") downloadText("manual-test-cases.md", toMarkdown(source), "text/markdown");
    if (format === "doc") downloadText("manual-test-cases.doc", toDocHtml(source), "application/msword");
    if (format === "pdf") downloadText("manual-test-cases.pdf", makePdfText("Manual Test Cases", toMarkdown(source)), "application/pdf");
  }

  return (
    <section className="panel qa-panel manual-test-studio">
      <div className="panel-header page-intro">
        <p className="eyebrow">Manual test management</p>
        <h2>AI manual test case studio</h2>
        <p>Generate manual tests with AI from a target URL and risk context, then review, edit, filter, and export them as a proper test-management grid.</p>
      </div>

      {message ? <p className="plain-status">{message}</p> : null}
      {lastMeta ? <p className="plain-status">Source: {lastMeta.source}{lastMeta.fallbackReason ? ` - ${lastMeta.fallbackReason}` : ""}</p> : null}

      <section className="subpanel">
        <div className="subpanel-heading">
          <h3>Generate manual tests with AI</h3>
          <p>Use this first. Give the AI a real URL and the risks or flows you care about. The generated cases appear in the grid below for review and export.</p>
        </div>
        <div className="qa-form-grid">
          <label className="qa-field-wide">Target URL<input value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} placeholder="https://your-app.com" /></label>
          <label>Workspace name<input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Regression suite" /></label>
          <label className="qa-field-short">Test count<input type="number" min="1" max="30" value={testCount} onChange={(event) => setTestCount(Number(event.target.value))} /></label>
          <label className="qa-field-full">Risk context<textarea value={riskContext} onChange={(event) => setRiskContext(event.target.value)} placeholder="Login, registration, checkout, navigation, form validation, permissions..." /></label>
          <label className="qa-field-full">Page or business context<textarea value={pageContext} onChange={(event) => setPageContext(event.target.value)} placeholder="Optional: business rules, roles, edge cases, known defects, acceptance criteria." /></label>
        </div>
        {aiValidationErrors.length ? <div className="validation-list">{aiValidationErrors.map((error) => <p key={error}>{error}</p>)}</div> : null}
        <div className="actions-row">
          <button className="primary-button" type="button" disabled={loading || aiValidationErrors.length > 0} onClick={generateAiCases}>{loading ? "Generating AI tests..." : "Generate AI manual tests"}</button>
        </div>
      </section>

      <section className="subpanel">
        <div className="subpanel-heading">
          <h3>Create or edit one manual test</h3>
          <p>Use this when you want to manually add a missing case or clean up an AI-generated case before export.</p>
        </div>
        <div className="qa-form-grid">
          <label className="qa-field-short">Test ID<input value={form.id} onChange={(event) => setForm({ ...form, id: event.target.value })} /></label>
          <label>Module<input value={form.module} onChange={(event) => setForm({ ...form, module: event.target.value })} placeholder="Authentication, Checkout, Navigation..." /></label>
          <label className="qa-field-wide">Title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
          <label>Priority<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as ManualPriority })}><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select></label>
          <label>Type<input value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} placeholder="Smoke, Regression, Negative..." /></label>
          <label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ManualStatus })}><option>Draft</option><option>Ready</option><option>Needs Review</option><option>Approved</option></select></label>
          <label className="qa-field-full">Preconditions<textarea value={form.preconditions} onChange={(event) => setForm({ ...form, preconditions: event.target.value })} /></label>
          <label className="qa-field-full">Steps<textarea value={form.steps} onChange={(event) => setForm({ ...form, steps: event.target.value })} placeholder={"1. Open page\n2. Perform action\n3. Verify result"} /></label>
          <label className="qa-field-full">Expected result<textarea value={form.expectedResult} onChange={(event) => setForm({ ...form, expectedResult: event.target.value })} /></label>
          <label className="qa-field-full">Test data<textarea value={form.testData} onChange={(event) => setForm({ ...form, testData: event.target.value })} /></label>
        </div>
        {formValidationErrors.length ? <div className="validation-list">{formValidationErrors.map((error) => <p key={error}>{error}</p>)}</div> : null}
        <div className="actions-row">
          <button className="primary-button" type="button" onClick={saveCase} disabled={formValidationErrors.length > 0}>Save manual test</button>
          <button className="secondary-button" type="button" onClick={() => setForm({ ...EMPTY_FORM, id: nextManualId(cases.length) })}>Clear form</button>
        </div>
      </section>

      <section className="subpanel">
        <div className="subpanel-heading">
          <h3>Manual test grid</h3>
          <p>{filteredCases.length} test case{filteredCases.length === 1 ? "" : "s"} shown. Click a row to inspect it, edit it, or export the current filtered set.</p>
        </div>
        <div className="qa-filter-row">
          <label>Search<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ID, title, module, priority..." /></label>
        </div>
        <div className="actions-row">
          <button className="secondary-button" type="button" onClick={() => exportCases("json")}>Export JSON</button>
          <button className="secondary-button" type="button" onClick={() => exportCases("csv")}>Export CSV</button>
          <button className="secondary-button" type="button" onClick={() => exportCases("xlsx")}>Export Excel CSV</button>
          <button className="secondary-button" type="button" onClick={() => exportCases("md")}>Export Markdown source</button>
          <button className="secondary-button" type="button" onClick={() => exportCases("doc")}>Export formatted DOC</button>
          <button className="secondary-button" type="button" onClick={() => exportCases("pdf")}>Export PDF</button>
        </div>
        <div className="qa-table-wrap">
          <table className="qa-test-table">
            <thead><tr><th>ID</th><th>Module</th><th>Title</th><th>Priority</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {filteredCases.map((testCase) => (
                <tr key={testCase.id} className={selectedCase?.id === testCase.id ? "selected-row" : ""} onClick={() => setSelectedId(testCase.id)}>
                  <td>{testCase.id}</td>
                  <td>{testCase.module}</td>
                  <td>{testCase.title}</td>
                  <td>{testCase.priority}</td>
                  <td>{testCase.type}</td>
                  <td>{testCase.status}</td>
                  <td>
                    <button className="secondary-button" type="button" onClick={(event) => { event.stopPropagation(); editCase(testCase); }}>Edit</button>
                    <button className="secondary-button danger-button" type="button" onClick={(event) => { event.stopPropagation(); deleteCase(testCase.id); }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedCase ? (
        <section className="subpanel">
          <div className="subpanel-heading"><h3>{selectedCase.id}: {selectedCase.title}</h3><p>{selectedCase.module} - {selectedCase.priority} - {selectedCase.status}</p></div>
          <div className="artifact-two-column">
            <div><h4>Preconditions</h4><p>{selectedCase.preconditions || "None"}</p><h4>Steps</h4><pre className="qa-json-preview">{selectedCase.steps}</pre></div>
            <div><h4>Expected result</h4><p>{selectedCase.expectedResult}</p><h4>Test data</h4><pre className="qa-json-preview">{selectedCase.testData || "No data specified"}</pre></div>
          </div>
        </section>
      ) : null}
    </section>
  );
}
