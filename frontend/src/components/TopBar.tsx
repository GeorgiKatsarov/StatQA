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
        <div className="brand-mark">SQ</div>
        <div>
          <p className="eyebrow">Website QA platform</p>
          <h1>StatQA</h1>
          {accountLabel ? <p className="topbar-meta">{accountLabel}</p> : null}
          <p className="topbar-meta">
            {email} | {analysesCount} analyses run
          </p>
        </div>
      </div>
      <div className="topbar-actions">
        <button className="secondary-button" onClick={onLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
