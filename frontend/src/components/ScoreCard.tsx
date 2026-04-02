interface ScoreCardProps {
  score: number;
  label: string;
  rootUrl: string;
}

export function ScoreCard({ score, label, rootUrl }: ScoreCardProps) {
  return (
    <section className="panel score-card">
      <div className="score-head">
        <div className="brand-lockup">
          <div className="brand-mark">SQ</div>
          <div>
            <p className="eyebrow">Audit report</p>
            <h2>StatQA</h2>
          </div>
        </div>
        <div className="score-inline">
          <span className="eyebrow">Overall score</span>
          <strong>{score}/100</strong>
        </div>
      </div>
      <div className="score-body">
        <div className="score-orb">
          <div className="score-value">{score}</div>
        </div>
        <div className="score-details">
          <p className="score-label">{label}</p>
          <p className="score-url">{rootUrl}</p>
        </div>
      </div>
    </section>
  );
}
