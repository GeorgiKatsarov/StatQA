import { useState } from "react";
import { AppSidebar } from "../components/AppSidebar";
import { QaWorkspace } from "../components/QaWorkspace";
import { TopBar } from "../components/TopBar";
import type { AnalysisSummary } from "../lib/api";
import type { AnalysisJob, AnalysisResult, AnalyzeRequest, AuthUser } from "../lib/types";

interface DashboardProps {
  analysis: AnalysisResult | null;
  activeAnalysisId?: string;
  history: AnalysisSummary[];
  user: AuthUser;
  loading: boolean;
  activeJob: AnalysisJob | null;
  error: string;
  onAnalyze: (payload: AnalyzeRequest) => Promise<void>;
  onSelectHistory: (analysisId: string) => Promise<void>;
  onLogout: () => void;
}

export function Dashboard({ user, error, onLogout }: DashboardProps) {
  const [activePage, setActivePage] = useState("qa-framework");

  return (
    <div className="dashboard-shell">
      <TopBar
        email={user.email}
        fullName={user.fullName}
        companyName={user.companyName}
        analysesCount={user.analysesCount}
        onLogout={onLogout}
      />
      <main className="app-layout">
        <AppSidebar activePage={activePage} onSelect={setActivePage} />
        <div className="dashboard-content">
          {error ? <p className="error-banner">{error}</p> : null}
          <QaWorkspace activePage={activePage} defaultUrl={user.websiteUrl || ""} onNavigate={setActivePage} />
        </div>
      </main>
    </div>
  );
}
