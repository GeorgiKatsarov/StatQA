interface TopBarProps {
  email: string;
  fullName?: string | null;
  companyName?: string | null;
  analysesCount: number;
  onLogout: () => void;
}

export function TopBar({ email, fullName, companyName, analysesCount, onLogout }: TopBarProps) {
  const accountLabel = [fullName, companyName].filter(Boolean).join(" at ");

  return (
    <header className="topbar">
      <div className="brand-lockup">
        <div className="brand-mark" aria-hidden="true">SQ</div>
        <div>
          <h1>StatQA</h1>
          <p className="topbar-meta">Website QA, generated tests, and Playwright framework builder</p>
        </div>
      </div>
      <div className="topbar-actions">
        <div className="account-chip">
          <strong>{accountLabel || email}</strong>
          <span>{analysesCount} scan{analysesCount === 1 ? "" : "s"} run</span>
        </div>
        <button className="secondary-button" onClick={onLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
