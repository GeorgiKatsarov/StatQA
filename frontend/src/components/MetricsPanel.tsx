interface MetricsPanelProps {
  metrics: Array<{ label: string; value: number }>;
}

export function MetricsPanel({ metrics }: MetricsPanelProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Metrics</h2>
      </div>
      <div className="card-grid">
        {metrics.map((metric) => (
          <article key={metric.label} className="panel compact-panel">
            <p className="eyebrow">{metric.label}</p>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

