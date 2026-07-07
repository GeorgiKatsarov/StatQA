interface AppSidebarProps {
  activePage: string;
  onSelect: (page: string) => void;
}

const sections = [
  {
    title: "Website scanning",
    pages: [
      { id: "scan", label: "Run scan" },
      { id: "static", label: "Risk signals" },
      { id: "behavior", label: "Behavior tests" },
      { id: "security", label: "Security risks" },
      { id: "reports", label: "Scan reports" },
      { id: "history", label: "History" }
    ]
  },
  {
    title: "AI QA automation",
    pages: [
      { id: "qa-generate", label: "Test generation" },
      { id: "qa-run", label: "Test running" },
      { id: "qa-reports", label: "QA reporting" },
      { id: "qa-archive", label: "Test archive" },
      { id: "qa-data", label: "Test data" }
    ]
  },
  {
    title: "Workspace",
    pages: [{ id: "settings", label: "Settings" }]
  }
];

export function AppSidebar({ activePage, onSelect }: AppSidebarProps) {
  return (
    <aside className="app-sidebar panel">
      <div className="panel-header">
        <p className="eyebrow">Workspace</p>
        <h2>Tools</h2>
      </div>
      <nav className="stack" aria-label="Main navigation">
        {sections.map((section) => (
          <div className="nav-section" key={section.title}>
            <p className="nav-section-title">{section.title}</p>
            <div className="nav-section-list">
              {section.pages.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  className={activePage === page.id ? "sidebar-item active" : "sidebar-item"}
                  onClick={() => onSelect(page.id)}
                >
                  {page.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
