interface TopBarProps {
  email: string;
  analysesCount: number;
  onLogout: () => void;
}

export function TopBar({ email, analysesCount, onLogout }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="brand-lockup">
        <div className="brand-mark">SQ</div>
        <div>
          <p className="eyebrow">Website QA platform</p>
          <h1>StatQA</h1>
          <p className="topbar-meta">
            {email} | {analysesCount}/5 analyses used
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
