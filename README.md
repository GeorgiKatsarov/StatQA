# StatQA

StatQA is an AI-assisted QA platform that turns a live web application or product brief into a practical Playwright TypeScript testing package. The product goal is simple: help teams move from “we should automate this” to a downloadable, reviewable test framework with manual test cases, automation decisions, page objects, reports, CI configuration, and traceability.

## Product promise

StatQA should let a user describe or scan an app, generate risk-based manual tests, decide which tests are safe to automate, preview the generated Playwright framework, and download a ZIP that can be committed into a real project.

The strongest sellable version is not just “AI writes tests.” The sellable version is “AI creates a QA starter kit that a real QA engineer can review, run, improve, and show to a team.”

## Current product pillars

- Website assessment: scan a target URL and surface content, behavior, and security risks.
- QA workspace: generate, review, archive, run, and report on generated test cases.
- Framework builder: create a Playwright TypeScript framework ZIP from application context.
- Reporting: export scan and QA results so the user has evidence, not only generated code.
- Portfolio mode: produce documentation that helps a junior QA or automation engineer explain the framework professionally.

## Sellable target workflow

1. Enter a target application URL or product description.
2. Add roles, critical flows, business rules, and risk areas.
3. Generate manual test cases with clear steps, expected results, priority, severity, and risk mapping.
4. Review automation suitability so unstable or subjective checks stay manual.
5. Generate a Playwright TypeScript framework with page objects, fixtures, test data, CI, reports, and documentation.
6. Preview generated files inside StatQA.
7. Download the full framework as a ZIP.
8. Run the generated suite locally or in CI and use the report as release evidence.

## Repository structure

```text
backend/   Express, TypeScript, Prisma, QA generation services
frontend/  React, Vite, TypeScript dashboard and framework builder UI
docs/      Product strategy, implementation plan, and generated-framework specification
```

## Local development

```bash
npm install
npm run dev:backend
npm run dev:frontend
```

Useful scripts:

```bash
npm run build:backend
npm run build:frontend
npm run test:browser
```

## Business-analysis implementation plan

See `docs/implementation-plan.md` for the productized roadmap. It is written from a senior business analyst/product owner perspective and breaks the work into discovery, MVP hardening, sellable beta, and commercial readiness.

## Generated framework contract

See `docs/generated-framework-spec.md` for the expected contents of every downloadable Playwright TypeScript framework.

## License

See [LICENSE](LICENSE). The repository uses a restrictive source-available license:

- public viewing is allowed
- private internal evaluation is allowed
- redistribution is not allowed
- modification is not allowed without written permission from the owner
- only the owner may publish derivative or edited versions by default

## Current status

StatQA has an MVP direction and working product surfaces for scan analysis, generated QA workspaces, and Playwright framework export. The next priority is productization: stronger onboarding, deterministic generated outputs, quality gates, billing-ready packaging, and a demo flow that proves value in under five minutes.
