import type { AnalysisJob } from "../lib/types";

interface ScanProgressProps {
  loading: boolean;
  estimatedSeconds: number;
  elapsedSeconds: number;
  targetUrl: string;
  job?: AnalysisJob | null;
  floating?: boolean;
}

const phases = [
  { label: "Validate URL", percent: 8 },
  { label: "Discover pages", percent: 24 },
  { label: "Capture evidence", percent: 48 },
  { label: "Run behavior tests", percent: 72 },
  { label: "Check security", percent: 88 },
  { label: "Generate report", percent: 100 }
];

function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export function estimateScanSeconds(url: string, maxPages = 30): number {
  const hasUrl = url.trim().length > 0;
  return hasUrl ? Math.max(35, Math.min(300, 20 + maxPages * 4)) : 75;
}

export function ScanProgress({ loading, estimatedSeconds, elapsedSeconds, targetUrl, job, floating }: ScanProgressProps) {
  const progress = job ? job.percent : loading
    ? Math.min(92, Math.max(4, Math.round((elapsedSeconds / Math.max(estimatedSeconds, 1)) * 100)))
    : 0;
  const remainingSeconds = loading ? Math.max(0, estimatedSeconds - elapsedSeconds) : estimatedSeconds;
  const activePhase = job?.message || (phases.find((phase) => progress <= phase.percent) ?? phases[phases.length - 1]).label;
  const className = floating ? "floating-progress" : "panel scan-progress";
  const pageStatus =
    job?.phase === "discovering"
      ? `${job.pagesDiscovered} discovered`
      : job?.totalPages
        ? `${job.pagesScanned}/${job.totalPages} pages`
        : `ETA ${formatDuration(remainingSeconds)}`;

  return (
    <section className={className}>
      <div className="panel-header">
        <p className="eyebrow">{loading ? "Running analysis" : "Scan planner"}</p>
        <h2>{loading ? activePhase : "Estimated scan time"}</h2>
        <p>
          {(job?.targetUrl || targetUrl).trim() || "Main URL not entered"} | Estimated {formatDuration(estimatedSeconds)}
        </p>
      </div>
      <div className="progress-meter" aria-label="Analysis progress">
        <div className="progress-meter-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="progress-stats">
        <span>{loading ? `${progress}% complete` : "Ready"}</span>
        <span>Elapsed {formatDuration(elapsedSeconds)}</span>
        <span>{pageStatus}</span>
      </div>
      {!floating ? (
        <ol className="phase-list">
          {phases.map((phase) => (
            <li key={phase.label} className={loading && progress >= phase.percent - 12 ? "active" : ""}>
              {phase.label}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
