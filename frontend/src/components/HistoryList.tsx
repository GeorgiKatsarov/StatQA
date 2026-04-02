import type { AnalysisSummary } from "../lib/api";

interface HistoryListProps {
  history: AnalysisSummary[];
  activeAnalysisId?: string;
  onSelect: (analysisId: string) => void;
}

export function HistoryList({ history, activeAnalysisId, onSelect }: HistoryListProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Recent analyses</h2>
        <p>{history.length} saved reports for this account.</p>
      </div>
      <div className="stack">
        {history.length === 0 ? (
          <p className="empty-state">No stored analyses yet. Run your first scan from the dashboard.</p>
        ) : (
          history.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === activeAnalysisId ? "page-row history-row active" : "page-row history-row"}
              onClick={() => onSelect(item.id)}
            >
              <div className="history-copy">
                <strong>{item.url}</strong>
                <p>{new Date(item.createdAt).toLocaleString()}</p>
              </div>
              <div className="page-stats">
                <span>{item.healthLabel}</span>
                <span>Score {item.score}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
