import { useEffect, useState } from "react";
import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";
import { ApiError, apiRequest, type AnalysisSummary, type StoredAnalysisResponse } from "./lib/api";
import { clearToken, getToken, setToken } from "./lib/auth";
import type { AnalysisResult, AuthUser } from "./lib/types";

export default function App() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | undefined>(undefined);
  const [history, setHistory] = useState<AnalysisSummary[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);

  function formatError(error: unknown, fallback: string): string {
    if (error instanceof ApiError) {
      if (error.code === "VALIDATION_ERROR" && error.details && typeof error.details === "object") {
        const fieldErrors = (error.details as { fieldErrors?: Record<string, string[]> }).fieldErrors;
        const flattened = fieldErrors
          ? Object.entries(fieldErrors)
              .flatMap(([field, messages]) => messages.map((message) => `${field}: ${message}`))
              .join(" | ")
          : "";

        return flattened ? `${error.message} ${flattened}` : error.message;
      }

      if (error.code === "USAGE_LIMIT_REACHED") {
        return "You have used all 5 free analyses. Create a new account or reset the test user before running more scans.";
      }

      return error.message;
    }

    return error instanceof Error ? error.message : fallback;
  }

  async function loadSessionData() {
    const [me, analyses] = await Promise.all([
      apiRequest<{ user: AuthUser }>("/auth/me"),
      apiRequest<{ analyses: AnalysisSummary[] }>("/analyses")
    ]);

    setUser(me.user);
    setHistory(analyses.analyses);
    setActiveAnalysisId((current) => current ?? analyses.analyses[0]?.id);
  }

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setAuthChecked(true);
      return;
    }

    void loadSessionData()
      .then(() => setIsAuthenticated(true))
      .catch(() => {
        clearToken();
        setIsAuthenticated(false);
        setUser(null);
        setHistory([]);
      })
      .finally(() => setAuthChecked(true));
  }, []);

  async function handleAuth(email: string, password: string) {
    setLoading(true);
    setError("");

    try {
      const path = mode === "login" ? "/auth/login" : "/auth/register";
      const response = await apiRequest<{ token: string }>(path, {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      setToken(response.token);
      await loadSessionData();
      setIsAuthenticated(true);
    } catch (authError) {
      setError(formatError(authError, "Authentication failed."));
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyze(url: string) {
    setLoading(true);
    setError("");

    try {
      const result = await apiRequest<AnalysisResult>("/analyze", {
        method: "POST",
        body: JSON.stringify({ url })
      });
      setAnalysis(result);
      await loadSessionData();
      const refreshedHistory = await apiRequest<{ analyses: AnalysisSummary[] }>("/analyses");
      setHistory(refreshedHistory.analyses);
      setActiveAnalysisId(refreshedHistory.analyses[0]?.id);
    } catch (analysisError) {
      setError(formatError(analysisError, "Analysis failed."));
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectHistory(analysisId: string) {
    setLoading(true);
    setError("");

    try {
      const stored = await apiRequest<StoredAnalysisResponse<AnalysisResult>>(`/analyses/${analysisId}`);
      setAnalysis(stored.analysis.reportJson);
      setActiveAnalysisId(stored.analysis.id);
    } catch (historyError) {
      setError(formatError(historyError, "Unable to load the saved analysis."));
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    clearToken();
    setIsAuthenticated(false);
    setAnalysis(null);
    setActiveAnalysisId(undefined);
    setUser(null);
    setHistory([]);
  }

  if (!authChecked) {
    return <div className="app-loading">Checking session...</div>;
  }

  if (!isAuthenticated) {
    return <Login mode={mode} loading={loading} error={error} onModeChange={setMode} onSubmit={handleAuth} />;
  }

  if (!user) {
    return <div className="app-loading">Loading dashboard...</div>;
  }

  return (
    <Dashboard
      analysis={analysis}
      activeAnalysisId={activeAnalysisId}
      history={history}
      user={user}
      loading={loading}
      error={error}
      onAnalyze={handleAnalyze}
      onSelectHistory={handleSelectHistory}
      onLogout={handleLogout}
    />
  );
}
