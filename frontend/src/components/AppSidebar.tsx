interface AppSidebarProps {
  activePage: string;
  onSelect: (page: string) => void;
}

const sections = [
  {
    title: "Assess",
    summary: "Find website quality, behavior, and security risks.",
    pages: [
      { id: "scan", label: "Run scan", hint: "Start here" },
      { id: "static", label: "Risk signals", hint: "Content and runtime" },
      { id: "behavior", label: "Behavior tests", hint: "Safe interactions" },
      { id: "security", label: "Security risks", hint: "Headers and forms" },
      { id: "reports", label: "Scan reports", hint: "Findings" },
      { id: "history", label: "History", hint: "Saved scans" }
    ]
  },
  {
    title: "Build test suite",
    summary: "Manual tests, automation, execution, and export.",
    pages: [
      { id: "qa-generate", label: "1. Manual tests", hint: "Create and review" },
      { id: "qa-framework", label: "2. Automatic tests", hint: "Build Playwright suite" },
      { id: "qa-run", label: "3. Test the tests", hint: "Execute checks" },
      { id: "qa-reports", label: "4. Results", hint: "Runs and evidence" },
      { id: "qa-data", label: "Test data", hint: "Synthetic datasets" },
      { id: "qa-archive", label: "Archive", hint: "Older tests" }
    ]
  },
  {
    title: "Configure",
    summary: "Set defaults for scans and QA work.",
    pages: [{ id: "settings", label: "Settings", hint: "Defaults" }]
  }
];

export function AppSidebar({ activePage, onSelect }: AppSidebarProps) {
  return (
    <aside className="app-sidebar panel">
      <div className="sidebar-header">
        <p className="eyebrow">Workflow</p>
        <h2>QA cockpit</h2>
        <p>Move from scan evidence to generated tests and a downloadable automation framework.</p>
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
