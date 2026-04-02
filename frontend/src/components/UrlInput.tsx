interface UrlInputProps {
  value: string;
  loading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export function UrlInput({ value, loading, onChange, onSubmit }: UrlInputProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Run analysis</h2>
        <p>Scan a public site and generate a structured QA report.</p>
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
    </section>
  );
}

