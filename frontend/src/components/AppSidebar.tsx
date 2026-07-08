interface AppSidebarProps {
  activePage: string;
  onSelect: (page: string) => void;
}

const sections = [
  {
    title: "Generate",
    summary: "Turn app context into a downloadable Playwright TypeScript framework.",
    pages: [
      { id: "qa-framework", label: "Framework builder", hint: "Hero feature" },
      { id: "qa-generate", label: "Manual test cases", hint: "Risk-based source" },
      { id: "qa-run", label: "Run generated tests", hint: "Execution" },
      { id: "qa-reports", label: "QA evidence", hint: "Results" }
    ]
  },
  {
    title: "Assess",
    summary: "Scan a live site for quality, behavior, and security signals.",
    pages: [
      { id: "scan", label: "Run scan", hint: "URL evidence" },
      { id: "static", label: "Risk signals", hint: "Content/runtime" },
      { id: "behavior", label: "Behavior checks", hint: "Safe interactions" },
      { id: "security", label: "Security risks", hint: "Headers/forms" },
      { id: "reports", label: "Scan reports", hint: "Findings" },
      { id: "history", label: "History", hint: "Saved scans" }
    ]
  },
  {
    title: "Prepare",
    summary: "Manage reusable inputs and defaults for repeatable QA work.",
    pages: [
      { id: "qa-data", label: "Test data", hint: "Datasets" },
      { id: "qa-archive", label: "Archive", hint: "Older tests" },
      { id: "settings", label: "Settings", hint: "Defaults" }
    ]
  }
];

export function AppSidebar({ activePage, onSelect }: AppSidebarProps) {
  return (
    <aside className="app-sidebar panel">
      <div className="sidebar-header">
        <p className="eyebrow">StatQA workflow</p>
        <h2>Framework cockpit</h2>
        <p>
          Create a reviewable QA package: manual cases, automation decisions, Playwright specs, CI, reports, and a downloadable ZIP.
        </p>
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
