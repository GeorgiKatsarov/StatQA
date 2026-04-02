interface SummaryCardsProps {
  critical: number;
  warnings: number;
  passed: number;
  pagesScanned: number;
  averageLoadTimeMs: number;
}

export function SummaryCards({ critical, warnings, passed, pagesScanned, averageLoadTimeMs }: SummaryCardsProps) {
  const items = [
    { label: "Passed", value: passed, tone: "good" },
    { label: "Warnings", value: warnings, tone: "warn" },
    { label: "Critical + Error", value: critical, tone: "bad" },
    { label: "Pages scanned", value: pagesScanned, tone: "neutral" },
    { label: "Avg load ms", value: averageLoadTimeMs, tone: "neutral" }
  ];

  return (
    <section className="card-grid">
      {items.map((item) => (
        <article key={item.label} className={`panel compact-panel summary-card summary-${item.tone}`}>
          <p className="eyebrow">{item.label}</p>
          <strong>{item.value}</strong>
        </article>
      ))}
    </section>
  );
}
