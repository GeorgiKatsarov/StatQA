import { useMemo, useState } from "react";

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
      <td>${testCase.id}</td>
      <td>${testCase.module}</td>
      <td>${testCase.title}</td>
      <td>${testCase.priority}</td>
      <td>${testCase.type}</td>
      <td>${testCase.status}</td>
      <td><pre>${testCase.steps}</pre></td>
      <td>${testCase.expectedResult}</td>
    </tr>
  `).join("");
  return `<html><head><meta charset="utf-8"><title>Manual Test Cases</title></head><body><h1>Manual Test Cases</h1><table border="1" cellspacing="0" cellpadding="6"><thead><tr><th>ID</th><th>Module</th><th>Title</th><th>Priority</th><th>Type</th><th>Status</th><th>Steps</th><th>Expected Result</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

function makePdfText(title: string, body: string) {
  const safeLines = `${title}\n\n${body}`.replace(/[()\\]/g, " ").split("\n").slice(0, 45);
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

export function ManualTestStudio() {
  const [cases, setCases] = useState<ManualCase[]>(SEED_CASES);
  const [form, setForm] = useState<ManualCase>({ ...EMPTY_FORM, id: `TC-MAN-${String(SEED_CASES.length + 1).padStart(3, "0")}` });
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(SEED_CASES[0]?.id ?? "");

  const filteredCases = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return cases;
    return cases.filter((testCase) => Object.values(testCase).join(" ").toLowerCase().includes(normalized));
  }, [cases, query]);
  const selectedCase = cases.find((testCase) => testCase.id === selectedId) ?? filteredCases[0];

  function saveCase() {
    if (!form.id.trim() || !form.title.trim() || !form.steps.trim() || !form.expectedResult.trim()) return;
    setCases((current) => {
      const exists = current.some((testCase) => testCase.id === form.id);
      return exists ? current.map((testCase) => testCase.id === form.id ? form : testCase) : [form, ...current];
    });
    setSelectedId(form.id);
    setForm({ ...EMPTY_FORM, id: `TC-MAN-${String(cases.length + 2).padStart(3, "0")}` });
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
        <h2>Zephyr-style manual test case studio</h2>
        <p>Create, review, edit, filter, and export manual test cases before generating automation. Use this for test management, interviews, planning, and QA documentation.</p>
      </div>

      <section className="subpanel">
        <div className="subpanel-heading">
          <h3>Create or edit a manual test</h3>
          <p>Required fields: ID, title, steps, and expected result.</p>
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
        <div className="actions-row">
          <button className="primary-button" type="button" onClick={saveCase} disabled={!form.id.trim() || !form.title.trim() || !form.steps.trim() || !form.expectedResult.trim()}>
            Save manual test
          </button>
          <button className="secondary-button" type="button" onClick={() => setForm({ ...EMPTY_FORM, id: `TC-MAN-${String(cases.length + 1).padStart(3, "0")}` })}>
            Clear form
          </button>
        </div>
      </section>

      <section className="subpanel">
        <div className="subpanel-heading">
          <h3>Manual test grid</h3>
          <p>{filteredCases.length} test case{filteredCases.length === 1 ? "" : "s"} shown. Click a row to inspect it.</p>
        </div>
        <div className="qa-filter-row">
          <label>Search<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ID, title, module, priority..." /></label>
        </div>
        <div className="actions-row">
          <button className="secondary-button" type="button" onClick={() => exportCases("json")}>Export JSON</button>
          <button className="secondary-button" type="button" onClick={() => exportCases("csv")}>Export CSV</button>
          <button className="secondary-button" type="button" onClick={() => exportCases("xlsx")}>Export Excel CSV</button>
          <button className="secondary-button" type="button" onClick={() => exportCases("md")}>Export Markdown</button>
          <button className="secondary-button" type="button" onClick={() => exportCases("doc")}>Export DOC</button>
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
