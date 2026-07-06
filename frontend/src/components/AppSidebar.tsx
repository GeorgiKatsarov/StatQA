interface AppSidebarProps {
  activePage: string;
  onSelect: (page: string) => void;
}

const pages = [
  { id: "scan", label: "Run scan" },
  { id: "static", label: "Risk signals" },
  { id: "behavior", label: "Behavior tests" },
  { id: "security", label: "Security risks" },
  { id: "reports", label: "Reports" },
  { id: "history", label: "History" },
  { id: "settings", label: "Settings" }
];

export function AppSidebar({ activePage, onSelect }: AppSidebarProps) {
  return (
    <aside className="app-sidebar panel">
      <div className="panel-header">
        <p className="eyebrow">Workspace</p>
        <h2>Tools</h2>
      </div>
      <nav className="stack" aria-label="Main navigation">
        {pages.map((page) => (
          <button
            key={page.id}
            type="button"
            className={activePage === page.id ? "sidebar-item active" : "sidebar-item"}
            onClick={() => onSelect(page.id)}
          >
            {page.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
