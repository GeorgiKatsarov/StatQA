interface PageBreakdownProps {
  pages: Array<{
    url: string;
    score: number;
    issueCount: number;
    healthLabel: string;
  }>;
}

export function PageBreakdown({ pages }: PageBreakdownProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Page breakdown</h2>
      </div>
      <div className="stack">
        {pages.map((page) => (
          <article key={page.url} className="page-row">
            <div>
              <strong>{page.url}</strong>
              <p>{page.healthLabel}</p>
            </div>
            <div className="page-stats">
              <span>Score {page.score}</span>
              <span>{page.issueCount} issues</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

