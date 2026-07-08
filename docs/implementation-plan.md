# StatQA Sellable Product Implementation Plan

## Executive summary

StatQA should be positioned as an AI QA co-pilot for small teams, solo founders, agencies, and junior-to-mid QA engineers who need a structured Playwright TypeScript framework quickly. The product should not promise perfect automation for every website. That promise is too broad and would create disappointment. The stronger commercial promise is that StatQA creates a professional QA starter framework, with traceability from manual cases to automated candidates, so teams can save setup time and avoid starting from a blank test repository.

## Product north star

A user can enter a target app URL and business context, wait for generation, review the proposed tests, and download a Playwright TypeScript framework that is structured well enough to commit to a real repository after human review.

The north-star activation event is: `Generated framework ZIP downloaded after at least one previewed test file`.

## Buyer personas

### 1. Startup founder or technical lead

They have a web app but no QA process. They want confidence before demos, investor calls, or customer launches. Their buying trigger is fear of embarrassing bugs.

### 2. Small agency

They build client websites and apps. They need a repeatable testing handoff package. Their buying trigger is reducing QA setup time per project.

### 3. Junior QA or automation engineer

They need a professional framework quickly for portfolio work, job preparation, or internal upskilling. Their buying trigger is career leverage.

### 4. QA lead in a small product team

They want standardization. Their buying trigger is turning inconsistent manual checks into structured coverage.

## Commercial positioning

Bad positioning: “AI that tests any app automatically.”

Better positioning: “Generate a reviewable Playwright TypeScript QA framework from your app context in minutes.”

Best positioning: “From app URL to test strategy, manual cases, automation candidates, Playwright code, CI, and reports — all exported as a ready-to-review framework.”

## MVP hardening priorities

### Phase 1: Trust and clarity

Goal: make the app understandable in five minutes.

Deliverables:

- Landing-style dashboard intro that explains the workflow.
- Demo dataset and demo framework generation path.
- Clear distinction between manual tests, automation candidates, and generated specs.
- Warnings that generated selectors and TODOs require review.
- Readiness score before ZIP export.

Acceptance criteria:

- A first-time user understands what to do without reading external docs.
- The product never claims generated tests are production-perfect.
- Export button is disabled or clearly warned when blocking validation exists.

### Phase 2: Framework quality

Goal: the exported ZIP feels like a professional starter repository.

Deliverables:

- `package.json` with useful scripts: smoke, regression, headed, UI mode, report.
- `playwright.config.ts` with HTML report, traces, screenshots, video, retries, CI reporter.
- Page objects for login, dashboard, and core workflows.
- Fixtures for authentication and reusable test setup.
- `.env.example` with role-based credentials.
- Manual test cases in Markdown and JSON.
- Automation decision table.
- CI workflow.
- Quality checklist and setup guide.

Acceptance criteria:

- Generated project installs with `npm install`.
- Generated project has at least one spec with visible assertions.
- No generated file contains unsafe paths.
- The README explains setup, environment variables, running tests, reports, and known assumptions.

### Phase 3: Sellable beta

Goal: make the product convincing enough for demos and early users.

Deliverables:

- One-click sample app context.
- Better progress states for generation.
- Preview tabs: Strategy, Manual Tests, Automation Decisions, Files.
- Downloadable ZIP manifest.
- Exported framework quality score.
- Saved workspaces and generation history.
- More visible reporting story.

Acceptance criteria:

- A demo can be completed in under five minutes.
- Generated framework contains enough files to look serious, but not so many that it becomes noise.
- User can explain why a test was or was not automated.

### Phase 4: Commercial readiness

Goal: prepare for real users and possible payment.

Deliverables:

- User quotas and rate limits.
- Generation cost tracking.
- Billing-ready plan boundaries: Free, Pro, Team.
- Workspace ownership and team sharing.
- Better error handling when AI provider fails.
- Privacy statement for submitted URLs and product context.
- Terms explaining that generated tests require human review.

Acceptance criteria:

- The app can protect itself from abuse and runaway AI cost.
- The user knows what data is stored.
- The product has a clear upgrade reason.

## Functional requirements

### FR-1: Application context capture

The user must be able to provide app name, URL, product description, roles, critical flows, business rules, risks, browsers, CI preference, and portfolio mode.

### FR-2: Manual test generation

The system must generate manual tests with title, objective, preconditions, test data, steps, expected results, priority, severity, classification, tags, risk area, and tester notes.

### FR-3: Automation suitability

The system must classify every manual test as `automate`, `manual-only`, or `needs-clarification`, with score, reasons, blockers, selector assumptions, test data needs, maintenance risk, and recommended automation layer.

### FR-4: Framework generation

The system must generate a Playwright TypeScript framework with configuration, scripts, page objects, fixtures, test data, specs, CI, documentation, and a manifest.

### FR-5: Preview before export

The user must be able to preview strategy, manual tests, automation decisions, and generated files before downloading the ZIP.

### FR-6: Export

The user must be able to download the generated package as a ZIP only when export validation has no blocking errors.

### FR-7: Evidence and reporting

The generated framework must support HTML reports and CI artifacts so users can show test results to a team.

## Non-functional requirements

- Generated files must avoid unsafe paths.
- Generation should degrade gracefully when the AI provider fails.
- The UI should clearly explain long-running generation states.
- Prompts must ask for structured JSON, not loose prose.
- Exported frameworks must avoid storing secrets.
- The product should be honest about assumptions and TODOs.

## Quality gates

A generated framework is export-ready only when:

- Required files exist.
- At least one `.spec.ts` file exists.
- Spec files include assertions.
- No path traversal or absolute paths are generated.
- No obvious arbitrary waits are used.
- Environment secrets are represented as placeholders.

## Pricing hypothesis

Free plan:

- 1 active workspace.
- Limited generations.
- Watermarked or portfolio-focused exports.

Pro plan:

- More generations.
- Full ZIP export.
- Saved history.
- CI templates.

Team plan:

- Shared workspaces.
- Review workflows.
- Higher quotas.
- Export governance.

## Metrics

Activation:

- Framework generated.
- File preview opened.
- ZIP downloaded.

Retention:

- User returns to same workspace.
- User regenerates after editing context.
- User exports reports.

Quality:

- Export validation pass rate.
- Average automation suitability score.
- AI fallback rate.
- Failed generation rate.

Revenue:

- Free-to-Pro conversion.
- ZIP exports per paying user.
- Team workspace creation.

## Immediate next engineering steps

1. Add a stronger productized dashboard intro.
2. Add framework readiness score to the builder UI.
3. Add generated framework manifest and quality checklist.
4. Add generation history per workspace.
5. Add sample/demo mode that does not require scanning a real app.
6. Add tests for framework validation and ZIP manifest contents.
7. Add deployment documentation.

## Risk register

| Risk | Impact | Mitigation |
| --- | --- | --- |
| AI generates fragile selectors | High | Prefer accessible selectors, include TODOs, require preview |
| Users expect perfect automation | High | Product copy must say reviewable starter framework |
| Generated tests fail on real apps | High | Add readiness score, assumptions, and setup checklist |
| AI cost grows too fast | Medium | Add quotas, caching, and fallback generation |
| Product feels like a toy | High | Strong docs, reports, CI, traceability, and serious UI language |

## Definition of done for a sellable beta

StatQA is sellable as an early beta when a new user can generate a framework, understand every artifact, download it, run installation commands, and see a professional report path without you personally explaining the product over a call.
