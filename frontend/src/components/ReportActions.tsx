interface ReportActionsProps {
  onExportJson: () => void;
  onCopySummary: () => Promise<void>;
}

export function ReportActions({ onExportJson, onCopySummary }: ReportActionsProps) {
  return (
    <section className="panel actions-panel">
      <div className="panel-header">
        <h2>Report actions</h2>
      </div>
      <div className="actions-row">
        <button className="secondary-button" onClick={onExportJson}>
          Export JSON
        </button>
        <button className="secondary-button" onClick={() => void onCopySummary()}>
          Copy summary
        </button>
      </div>
    </section>
  );
}
