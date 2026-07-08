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

const workflowSteps = [
  {
    title: "1. Describe the product",
    detail: "Use this before generation. Add the real URL, business context, roles, flows, rules, risks, and optional safe test accounts."
  },
  {
    title: "2. Generate the framework",
    detail: "Use this when the context checklist is green. StatQA should be slow here because it analyzes the live site and builds the POM framework."
  },
  {
    title: "3. Run generated checks",
    detail: "Use this before downloading. It proves whether the generated browser checks can open the real observed pages from the app."
  },
  {
    title: "4. Review failing checks",
    detail: "Use this when the run is red. Fix product context, unreachable URLs, unstable public content, or unsafe assumptions, then regenerate."
  },
  {
    title: "5. Download and continue locally",
    detail: "Use this only after review. Add real secrets to .env locally, run npm test, then extend authenticated flows with cleanup-safe POMs."
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
      <div className="nav-section workflow-guide-card">
        <div className="nav-section-heading">
          <p className="nav-section-title">How to use this page</p>
          <span>Follow the workflow in order. Do not download first.</span>
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
