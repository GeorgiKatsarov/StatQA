# Generated Playwright Framework Specification

This document defines what StatQA should generate when a user downloads a Playwright TypeScript framework.

## Design principles

The generated framework must be reviewable, runnable, and honest. It should not hide uncertainty. It should produce useful structure, strong defaults, and clear TODOs where app-specific selectors or routes are unknown.

## Required generated files

```text
package.json
tsconfig.json
playwright.config.ts
.env.example
.gitignore
README.md
statqa-framework-manifest.json
config/testMetadata.ts
data/users.ts
data/manualTestCases.json
docs/manual-test-cases.md
docs/test-strategy.md
docs/automation-decisions.md
fixtures/auth.fixture.ts
pages/LoginPage.ts
pages/DashboardPage.ts
pages/CoreWorkflowPage.ts
utils/env.ts
utils/dateUtils.ts
tests/auth/login.spec.ts
```

## Conditional generated files

```text
tests/workflows/core-flow.spec.ts
.github/workflows/playwright.yml
docs/interview-demo-script.md
```

`tests/workflows/core-flow.spec.ts` should exist when at least one workflow or validation test is recommended for automation.

`.github/workflows/playwright.yml` should exist when the user chooses CI output.

`docs/interview-demo-script.md` should exist when portfolio mode is enabled.

## Framework behavior

The exported framework should support:

- `npm test` for full Playwright execution.
- `npm run test:headed` for debugging.
- `npm run test:ui` for Playwright UI mode.
- `npm run test:smoke` for smoke tests.
- `npm run test:regression` for regression tests.
- `npm run report` for opening the HTML report.

## Reporting requirements

The generated `playwright.config.ts` must configure:

- List reporter for local command line feedback.
- HTML report stored in `reports/html-report`.
- JUnit report in CI.
- Trace on first retry.
- Screenshot only on failure.
- Video retained on failure.
- CI retries.

## Test design requirements

Generated test files must:

- Use `@playwright/test`.
- Use `test.describe` blocks.
- Include visible `expect` assertions.
- Prefer accessible selectors like `getByRole` and `getByLabel`.
- Avoid `waitForTimeout`.
- Read credentials from environment variables.
- Keep business flow logic inside page objects where possible.
- Use tags like `@smoke`, `@regression`, `@security`, or `@validation`.

## Page object requirements

Generated page objects should hide selector details and expose intent-focused methods.

Example method quality:

```ts
await loginPage.signIn(email, password);
await workflowPage.openPrimaryAction(/create task/i);
await workflowPage.assertRecordVisible(uniqueTitle);
```

Bad generated method quality:

```ts
await page.locator("div > div:nth-child(3) > button").click();
```

## Environment requirements

The generated `.env.example` must include `BASE_URL` and role-based credentials. Real secrets must never be generated.

Example:

```env
BASE_URL=https://example.test
ADMIN_EMAIL=admin.test@example.com
ADMIN_PASSWORD=replace-with-test-password
MANAGER_EMAIL=manager.test@example.com
MANAGER_PASSWORD=replace-with-test-password
```

## Manual test traceability

Every generated manual test should include:

- ID.
- Feature.
- Title.
- Objective.
- Preconditions.
- Test data.
- Steps and expected results.
- Final expected result.
- Priority.
- Severity.
- Classification.
- Automation suitability.
- Tags.
- Risk area.
- Tester notes.

## Automation decision requirements

Every manual test must have an automation decision with:

- Recommendation.
- Score.
- Reasons.
- Blockers.
- Selector assumptions.
- Test data needs.
- Maintenance risk.
- Recommended automation layer.

## Validation rules

StatQA must block export when:

- A required file is missing.
- A file path is unsafe.
- Duplicate file paths exist.
- No Playwright spec file exists.

StatQA should warn when:

- A spec file has no visible assertion.
- Generated code uses arbitrary waits.
- A generated file contains unresolved placeholders that require user action.

## Manifest requirements

The ZIP manifest should include:

```json
{
  "projectName": "Example App",
  "generatedAt": "2026-07-08T00:00:00.000Z",
  "fileCount": 20,
  "manualTests": 10,
  "automatedCandidates": 7,
  "assumptions": [],
  "validation": {
    "exportReady": true,
    "blockingErrors": [],
    "warnings": []
  }
}
```

## Human-review disclaimer

Every exported framework should clearly state that generated tests are a starting point. The user must confirm selectors, credentials, routes, test data cleanup, and expected business behavior before relying on the framework in production CI.
