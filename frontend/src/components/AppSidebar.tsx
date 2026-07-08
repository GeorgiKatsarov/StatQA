interface AppSidebarProps {
  activePage: string;
  onSelect: (page: string) => void;
}

const sections = [
  {
    title: "Build",
    summary: "Generate, run, review, and download one full Playwright TypeScript framework.",
    pages: [
      { id: "qa-framework", label: "Framework builder", hint: "Single workflow" }
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
          One focused flow: describe the product, analyze the site, generate a strict POM-based Playwright framework, run the checks, and download the ZIP.
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
