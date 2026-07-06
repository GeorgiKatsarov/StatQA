import type { AnalyzeRequest } from "../lib/types";

function formatEstimate(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s` : `${seconds}s`;
}

export const testSuites = [
  {
    id: "content",
    label: "Risk signals",
    description: "Optional page-risk signals for launch readiness: broken assets, runtime errors, missing form basics, and severe content gaps."
  },
  {
    id: "behavior",
    label: "Behavior tests",
    description: "Safely exercises user paths: search, non-sensitive forms, standalone buttons, and important internal links."
  },
  {
    id: "security",
    label: "Security checks",
    description: "Checks browser-facing security risks such as HTTPS, headers, mixed content, and unsafe form submission."
  }
];

export const securityOptions = [
  { id: "https", label: "HTTPS enforcement" },
  { id: "hsts", label: "HSTS header" },
  { id: "csp", label: "Content Security Policy" },
  { id: "clickjacking", label: "Clickjacking protection" },
  { id: "mixed-content", label: "Mixed content" },
  { id: "insecure-forms", label: "Insecure form actions" },
  { id: "password-http", label: "Password fields on HTTP" }
];

interface UrlInputProps {
  value: string;
  loading: boolean;
  estimatedSeconds: number;
  selectedSuites: string[];
  onToggleSuite: (suite: string) => void;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export function UrlInput({
  value,
  loading,
  estimatedSeconds,
  selectedSuites,
  onToggleSuite,
  onChange,
  onSubmit
}: UrlInputProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <p className="eyebrow">Main URL</p>
        <h2>Run full-site analysis</h2>
        <p>
          This URL is used as the crawl root. Estimated runtime before starting: {formatEstimate(estimatedSeconds)}.
        </p>
      </div>
      <div className="input-row">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://example.com"
          disabled={loading}
        />
        <button onClick={onSubmit} disabled={loading || !value.trim()}>
          {loading ? "Analyzing..." : "Run Analysis"}
        </button>
      </div>
      <div className="suite-toggle-row" aria-label="Test suites">
        {testSuites.map((suite) => (
          <label key={suite.id} className="suite-toggle">
            <input
              type="checkbox"
              checked={selectedSuites.includes(suite.id)}
              onChange={() => onToggleSuite(suite.id)}
              disabled={loading || (selectedSuites.length === 1 && selectedSuites.includes(suite.id))}
            />
            {suite.label}
          </label>
        ))}
      </div>
    </section>
  );
}

interface StaticSetupProps {
  selectedSuites: string[];
  onToggleSuite: (suite: string) => void;
  onRun: () => void;
  loading: boolean;
}

export function StaticAnalysisSetup({ selectedSuites, onToggleSuite, onRun, loading }: StaticSetupProps) {
  return (
    <section className="panel check-setup">
      <div className="check-explanation">
        <p className="eyebrow">Risk signals</p>
        <h2>Optional page quality signals</h2>
        <p>{testSuites[0].description}</p>
      </div>
      <label className="suite-toggle">
        <input type="checkbox" checked={selectedSuites.includes("content")} onChange={() => onToggleSuite("content")} />
        Include risk signals in full scans
      </label>
      <div className="setup-grid">
        <div className="setup-card">
          <strong>Metadata and structure</strong>
          <p>Looks for missing titles, descriptions, language attributes, headings, and landmarks.</p>
        </div>
        <div className="setup-card">
          <strong>Content quality</strong>
          <p>Finds thin content, placeholder copy, broken images, missing alt text, and empty links.</p>
        </div>
        <div className="setup-card">
          <strong>Runtime signals</strong>
          <p>Captures console errors, load time, script count, and large DOM warnings.</p>
        </div>
      </div>
      <div className="actions-row">
        <button className="primary-button" onClick={onRun} disabled={loading}>
          {loading ? "Running..." : "Run risk signal check"}
        </button>
      </div>
    </section>
  );
}

interface BehaviorSetupProps {
  selectedSuites: string[];
  behavior: AnalyzeRequest["behavior"];
  onToggleSuite: (suite: string) => void;
  onBehaviorChange: (behavior: AnalyzeRequest["behavior"]) => void;
  onRun: () => void;
  loading: boolean;
}

export function BehaviorSetup({ selectedSuites, behavior, onToggleSuite, onBehaviorChange, onRun, loading }: BehaviorSetupProps) {
  function updateBehavior<K extends keyof AnalyzeRequest["behavior"]>(key: K, nextValue: AnalyzeRequest["behavior"][K]) {
    onBehaviorChange({ ...behavior, [key]: nextValue });
  }

  return (
    <section className="panel check-setup">
      <div className="check-explanation">
        <p className="eyebrow">Behavior tests</p>
        <h2>Choose how StatQA interacts with the site</h2>
        <p>{testSuites[1].description}</p>
      </div>
      <label className="suite-toggle">
        <input type="checkbox" checked={selectedSuites.includes("behavior")} onChange={() => onToggleSuite("behavior")} />
        Include behavior tests in full scans
      </label>
      <div className="setup-grid">
        <label className="checkbox-row">
          <input type="checkbox" checked={behavior.testForms} onChange={(event) => updateBehavior("testForms", event.target.checked)} />
          Test safe forms
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={behavior.testSearch} onChange={(event) => updateBehavior("testSearch", event.target.checked)} />
          Test search inputs
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={behavior.testButtons} onChange={(event) => updateBehavior("testButtons", event.target.checked)} />
          Test standalone buttons
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={behavior.testLinks} onChange={(event) => updateBehavior("testLinks", event.target.checked)} />
          Test important internal links
        </label>
        <label>
          Sample text/search value
          <input value={behavior.sampleText} onChange={(event) => updateBehavior("sampleText", event.target.value)} />
        </label>
        <label>
          Sample email
          <input value={behavior.sampleEmail} onChange={(event) => updateBehavior("sampleEmail", event.target.value)} />
        </label>
        <label>
          Sample phone
          <input value={behavior.samplePhone} onChange={(event) => updateBehavior("samplePhone", event.target.value)} />
        </label>
        <label>
          Sample password
          <input type="password" value={behavior.samplePassword} onChange={(event) => updateBehavior("samplePassword", event.target.value)} />
        </label>
        <label>
          Sample URL
          <input value={behavior.sampleUrl} onChange={(event) => updateBehavior("sampleUrl", event.target.value)} />
        </label>
      </div>
      <div className="actions-row">
        <button className="primary-button" onClick={onRun} disabled={loading}>
          {loading ? "Running..." : "Run behavior check"}
        </button>
      </div>
    </section>
  );
}

interface SecuritySetupProps {
  selectedSuites: string[];
  securityChecks: string[];
  onToggleSuite: (suite: string) => void;
  onToggleSecurityCheck: (check: string) => void;
  onRun: () => void;
  loading: boolean;
}

export function SecuritySetup({
  selectedSuites,
  securityChecks,
  onToggleSuite,
  onToggleSecurityCheck,
  onRun,
  loading
}: SecuritySetupProps) {
  return (
    <section className="panel check-setup">
      <div className="check-explanation">
        <p className="eyebrow">Security checks</p>
        <h2>Select browser-facing vulnerability checks</h2>
        <p>{testSuites[2].description}</p>
      </div>
      <label className="suite-toggle">
        <input type="checkbox" checked={selectedSuites.includes("security")} onChange={() => onToggleSuite("security")} />
        Include security checks in full scans
      </label>
      <div className="setup-grid">
        {securityOptions.map((option) => (
          <label key={option.id} className="checkbox-row">
            <input
              type="checkbox"
              checked={securityChecks.includes(option.id)}
              onChange={() => onToggleSecurityCheck(option.id)}
              disabled={securityChecks.length === 1 && securityChecks.includes(option.id)}
            />
            {option.label}
          </label>
        ))}
      </div>
      <div className="actions-row">
        <button className="primary-button" onClick={onRun} disabled={loading}>
          {loading ? "Running..." : "Run security check"}
        </button>
      </div>
    </section>
  );
}
