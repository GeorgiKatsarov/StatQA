import { useMemo, useState } from "react";

type DataRecord = Record<string, string | number | boolean>;

type DataSet = {
  name: string;
  description: string;
  records: DataRecord[];
};

const BUILT_IN_DATASETS: DataSet[] = [
  {
    name: "Valid signup users",
    description: "Safe non-production users for signup, profile, and onboarding forms.",
    records: [
      { email: "qa.user.one@example.test", fullName: "Alex QA", company: "StatQA Demo", password: "SafePass123!", phone: "+359888100001" },
      { email: "qa.user.two@example.test", fullName: "Maria Tester", company: "Automation Lab", password: "SafePass456!", phone: "+359888100002" },
      { email: "qa.user.three@example.test", fullName: "Jordan Analyst", company: "Regression Studio", password: "SafePass789!", phone: "+359888100003" }
    ]
  },
  {
    name: "Invalid boundary users",
    description: "Negative and boundary data for validation checks.",
    records: [
      { email: "missing-at-symbol", fullName: "A", company: "", password: "short", phone: "abc" },
      { email: "", fullName: "", company: "No Email Ltd", password: "", phone: "" },
      { email: "very.long.email.address.for.boundary.testing@example.test", fullName: "Boundary Test User With A Very Long Name", company: "Boundary Corp", password: "password", phone: "+000000000000" }
    ]
  },
  {
    name: "Checkout examples",
    description: "Non-payment demo data for checkout/address flows. Do not use real cards.",
    records: [
      { firstName: "Alex", lastName: "Ivanov", address: "1 Test Street", city: "Sofia", postalCode: "1000", country: "Bulgaria" },
      { firstName: "Maria", lastName: "Petrova", address: "2 Demo Avenue", city: "Plovdiv", postalCode: "4000", country: "Bulgaria" },
      { firstName: "Jordan", lastName: "QA", address: "", city: "", postalCode: "INVALID", country: "Testland" }
    ]
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

function csvEscape(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function toCsv(records: DataRecord[]) {
  const headers = Array.from(new Set(records.flatMap((record) => Object.keys(record))));
  const rows = records.map((record) => headers.map((header) => csvEscape(record[header])).join(","));
  return [headers.map(csvEscape).join(","), ...rows].join("\n");
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function toDocHtml(dataset: DataSet) {
  const headers = Array.from(new Set(dataset.records.flatMap((record) => Object.keys(record))));
  const rows = dataset.records.map((record) => `<tr>${headers.map((header) => `<td>${escapeHtml(String(record[header] ?? ""))}</td>`).join("")}</tr>`).join("");
  return `<html><head><meta charset="utf-8"><title>${escapeHtml(dataset.name)}</title><style>body{font-family:Arial,sans-serif}table{border-collapse:collapse;width:100%}th,td{border:1px solid #cfd8e3;padding:8px;vertical-align:top}th{background:#eef2ff;text-align:left}</style></head><body><h1>${escapeHtml(dataset.name)}</h1><p>${escapeHtml(dataset.description)}</p><table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

function toMarkdown(dataset: DataSet) {
  const headers = Array.from(new Set(dataset.records.flatMap((record) => Object.keys(record))));
  const rows = dataset.records.map((record) => `| ${headers.map((header) => String(record[header] ?? "").replace(/\|/g, "/")).join(" | ")} |`);
  return [`# ${dataset.name}`, "", dataset.description, "", `| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`, ...rows].join("\n");
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

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "test-data";
}

function parseFields(value: string) {
  return value.split(",").map((field) => field.trim()).filter(Boolean);
}

function generateRecords(description: string, fieldsText: string, count: number): DataRecord[] {
  const fields = parseFields(fieldsText);
  const lowerDescription = description.toLowerCase();
  return Array.from({ length: count }).map((_, index) => {
    const record: DataRecord = {};
    for (const field of fields) {
      const key = field.toLowerCase();
      if (key.includes("email")) record[field] = lowerDescription.includes("invalid") && index % 2 === 0 ? `invalid-email-${index}` : `qa.generated.${index + 1}@example.test`;
      else if (key.includes("password")) record[field] = index % 2 === 0 ? "SafePass123!" : "short";
      else if (key.includes("phone")) record[field] = `+35988820${String(index).padStart(4, "0")}`;
      else if (key.includes("name")) record[field] = `Generated User ${index + 1}`;
      else if (key.includes("company")) record[field] = `Generated Company ${index + 1}`;
      else if (key.includes("city")) record[field] = index % 2 === 0 ? "Sofia" : "Plovdiv";
      else if (key.includes("postal") || key.includes("zip")) record[field] = index % 2 === 0 ? "1000" : "INVALID";
      else if (key.includes("amount") || key.includes("price")) record[field] = index % 2 === 0 ? 100 + index : -1;
      else if (key.includes("enabled") || key.includes("active")) record[field] = index % 2 === 0;
      else record[field] = `${field} value ${index + 1}`;
    }
    return record;
  });
}

export function TestDataStudio() {
  const [datasets, setDatasets] = useState<DataSet[]>(BUILT_IN_DATASETS);
  const [selectedName, setSelectedName] = useState(BUILT_IN_DATASETS[0].name);
  const [description, setDescription] = useState("Signup form data with valid, invalid, and boundary examples");
  const [fields, setFields] = useState("email, fullName, companyName, password, phone");
  const [count, setCount] = useState(5);

  const selectedDataset = useMemo(() => datasets.find((dataset) => dataset.name === selectedName) ?? datasets[0], [datasets, selectedName]);
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (description.trim().length < 10) errors.push("Describe the scenario so the data has a purpose.");
    if (parseFields(fields).length === 0) errors.push("Add at least one comma-separated field name.");
    if (parseFields(fields).some((field) => field.length < 2)) errors.push("Each field name must be at least two characters.");
    if (!Number.isInteger(count) || count < 1 || count > 50) errors.push("Rows must be between 1 and 50.");
    return errors;
  }, [count, description, fields]);

  function generateDataset() {
    if (validationErrors.length) return;
    const name = `Custom ${new Date().toLocaleTimeString()}`;
    const dataset: DataSet = {
      name,
      description: description.trim(),
      records: generateRecords(description, fields, count)
    };
    setDatasets((current) => [dataset, ...current]);
    setSelectedName(name);
  }

  function exportDataset(format: "json" | "csv" | "xlsx" | "md" | "doc" | "pdf") {
    if (!selectedDataset) return;
    const filename = slug(selectedDataset.name);
    if (format === "json") downloadText(`${filename}.json`, JSON.stringify(selectedDataset, null, 2), "application/json");
    if (format === "csv") downloadText(`${filename}.csv`, toCsv(selectedDataset.records), "text/csv");
    if (format === "xlsx") downloadText(`${filename}-excel.csv`, toCsv(selectedDataset.records), "application/vnd.ms-excel");
    if (format === "md") downloadText(`${filename}.md`, toMarkdown(selectedDataset), "text/markdown");
    if (format === "doc") downloadText(`${filename}.doc`, toDocHtml(selectedDataset), "application/msword");
    if (format === "pdf") downloadText(`${filename}.pdf`, makePdfText(selectedDataset.name, toMarkdown(selectedDataset)), "application/pdf");
  }

  return (
    <section className="panel qa-panel test-data-studio">
      <div className="panel-header page-intro">
        <p className="eyebrow">Test data studio</p>
        <h2>Reusable datasets and export files</h2>
        <p>Use this page to prepare the data that manual testers and automation will need: valid users, invalid boundary values, address data, and custom fields. Export raw data for tooling or formatted DOC/PDF files for review.</p>
      </div>

      <section className="subpanel">
        <div className="subpanel-heading">
          <h3>Built-in datasets</h3>
          <p>Safe seed data for demos, manual cases, and early automation. Select a dataset to preview or export it.</p>
        </div>
        <div className="manual-test-grid">
          {datasets.map((dataset) => (
            <button key={dataset.name} type="button" className={`manual-test-card ${dataset.name === selectedName ? "active" : ""}`} onClick={() => setSelectedName(dataset.name)}>
              <div className="test-card-header"><strong>{dataset.name}</strong><span className="badge">{dataset.records.length} rows</span></div>
              <p>{dataset.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="subpanel">
        <div className="subpanel-heading">
          <h3>Describe needed data</h3>
          <p>Write the scenario and fields. StatQA will create deterministic safe records, not real customer or production data.</p>
        </div>
        <div className="qa-form-grid">
          <label className="qa-field-full">Scenario<textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <label className="qa-field-wide">Fields<input value={fields} onChange={(event) => setFields(event.target.value)} placeholder="email, fullName, password" /></label>
          <label className="qa-field-short">Rows<input type="number" min="1" max="50" value={count} onChange={(event) => setCount(Number(event.target.value))} /></label>
        </div>
        {validationErrors.length ? <div className="validation-list">{validationErrors.map((error) => <p key={error}>{error}</p>)}</div> : null}
        <div className="actions-row"><button className="primary-button" type="button" disabled={validationErrors.length > 0} onClick={generateDataset}>Generate dataset</button></div>
      </section>

      {selectedDataset ? (
        <section className="subpanel">
          <div className="subpanel-heading"><h3>{selectedDataset.name}</h3><p>{selectedDataset.description}</p></div>
          <div className="actions-row">
            <button className="secondary-button" type="button" onClick={() => exportDataset("json")}>Export JSON</button>
            <button className="secondary-button" type="button" onClick={() => exportDataset("csv")}>Export CSV</button>
            <button className="secondary-button" type="button" onClick={() => exportDataset("xlsx")}>Export Excel CSV</button>
            <button className="secondary-button" type="button" onClick={() => exportDataset("md")}>Export Markdown source</button>
            <button className="secondary-button" type="button" onClick={() => exportDataset("doc")}>Export formatted DOC</button>
            <button className="secondary-button" type="button" onClick={() => exportDataset("pdf")}>Export PDF</button>
          </div>
          <div className="qa-table-wrap">
            <table className="qa-test-table">
              <thead><tr>{Object.keys(selectedDataset.records[0] ?? {}).map((header) => <th key={header}>{header}</th>)}</tr></thead>
              <tbody>{selectedDataset.records.map((record, index) => <tr key={index}>{Object.keys(selectedDataset.records[0] ?? {}).map((header) => <td key={header}>{String(record[header] ?? "")}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </section>
      ) : null}
    </section>
  );
}
