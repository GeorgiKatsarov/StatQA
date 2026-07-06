interface PageBreakdownProps {
  pages: Array<{
    url: string;
    score: number;
    issueCount: number;
    healthLabel: string;
    issues: Array<{
      category: string;
      severity: string;
    }>;
  }>;
}

function summarizeCategories(page: PageBreakdownProps["pages"][number]): string {
  const categories = page.issues.reduce<Record<string, number>>((accumulator, issue) => {
    accumulator[issue.category] = (accumulator[issue.category] ?? 0) + 1;
    return accumulator;
  }, {});

  return (
    Object.entries(categories)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 4)
      .map(([category, count]) => `${category}: ${count}`)
      .join(" | ") || "No findings"
  );
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
              <p>{page.healthLabel} | {summarizeCategories(page)}</p>
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
