interface AppSidebarProps {
  activePage: string;
  onSelect: (page: string) => void;
}

const sections = [
  {
    title: "Analyze",
    summary: "Fast risk scan before test design.",
    pages: [
      { id: "static-analysis", label: "Static analysis", hint: "Site health" }
    ]
  },
  {
    title: "Design",
    summary: "AI manual cases and reusable test data.",
    pages: [
      { id: "manual-tests", label: "Manual test studio", hint: "AI + grid" },
      { id: "test-data-studio", label: "Test data studio", hint: "JSON, CSV, DOC, PDF" }
    ]
  },
  {
    title: "Automate",
    summary: "Generate the downloadable Playwright framework.",
    pages: [
      { id: "qa-framework", label: "Framework builder", hint: "POM framework" }
    ]
  }
];

export function AppSidebar({ activePage, onSelect }: AppSidebarProps) {
  return (
    <aside className="app-sidebar panel">
      <div className="sidebar-header">
        <p className="eyebrow">StatQA workflow</p>
        <h2>QA cockpit</h2>
        <p>Use each page for real work: scan risk, generate manual cases, prepare data, then build automation.</p>
      </div>
      <nav className="stack" aria-label="Main navigation">
        {sections.map((section) => (
          <div className="nav-section" key={section.title}>
            <div className="nav-section-heading">
              <p className="nav-section-title">{section.title}</p>
              <span>{section.summary}</span>
            </div>
            <div className="nav-section-list">
              {section.pages.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  className={activePage === page.id ? "sidebar-item active" : "sidebar-item"}
                  onClick={() => onSelect(page.id)}
                >
                  <span>{page.label}</span>
                  <small>{page.hint}</small>
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
