interface AppSidebarProps {
  activePage: string;
  onSelect: (page: string) => void;
}

const sections = [
  {
    title: "Analyze",
    summary: "Use static analysis as a risk map, not as fake QA completion.",
    pages: [
      { id: "static-analysis", label: "Static analysis", hint: "Useful site health" }
    ]
  },
  {
    title: "Design",
    summary: "Create manual tests and reusable data before automation.",
    pages: [
      { id: "manual-tests", label: "Manual test studio", hint: "Zephyr-style grid" },
      { id: "test-data-studio", label: "Test data studio", hint: "JSON, CSV, DOC, PDF" }
    ]
  },
  {
    title: "Automate",
    summary: "Generate, run, review, and download one full Playwright TypeScript framework.",
    pages: [
      { id: "qa-framework", label: "Framework builder", hint: "POM framework" }
    ]
  }
];

const workflowSteps = [
  {
    title: "1. Static scan",
    detail: "Use this first when you need a risk map of pages, forms, links, accessibility, and obvious technical issues."
  },
  {
    title: "2. Manual tests",
    detail: "Create reviewed manual cases in the grid. Export them for Zephyr/TestRail-style review or portfolio evidence."
  },
  {
    title: "3. Test data",
    detail: "Prepare valid, invalid, boundary, and role-based data. Export files for docs, Excel, PDF, or JSON usage."
  },
  {
    title: "4. Framework",
    detail: "Generate the full POM-based Playwright framework only after you know the flows, risks, and data you want."
  },
  {
    title: "5. Run and download",
    detail: "Run generated checks from the app, review pass/fail output, then download and continue locally with .env secrets."
  }
];

export function AppSidebar({ activePage, onSelect }: AppSidebarProps) {
  return (
    <aside className="app-sidebar panel">
      <div className="sidebar-header">
        <p className="eyebrow">StatQA workflow</p>
        <h2>QA cockpit</h2>
        <p>
          A practical QA workflow: analyze risk, design manual coverage, prepare test data, then generate and run a full Playwright framework.
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
      <div className="nav-section workflow-guide-card">
        <div className="nav-section-heading">
          <p className="nav-section-title">How to use the site</p>
          <span>Follow the workflow in order when building a serious QA package.</span>
        </div>
        <div className="qa-list compact-framework-list">
          {workflowSteps.map((step) => (
            <article className="test-row" key={step.title}>
              <strong>{step.title}</strong>
              <p>{step.detail}</p>
            </article>
          ))}
        </div>
      </div>
    </aside>
  );
}
