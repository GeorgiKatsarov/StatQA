const steps = [
  "Validating target",
  "Crawling pages",
  "Scraping content",
  "Evaluating issues",
  "Generating report"
];

export function Loader() {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Analysis in progress</h2>
        <p>The backend is moving through the audit pipeline.</p>
      </div>
      <div className="loader-bar">
        <div className="loader-bar-fill" />
      </div>
      <ul className="loader-steps">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ul>
    </section>
  );
}

