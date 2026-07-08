# Framework Builder Workflow Plan

This document defines the intended StatQA framework-builder workflow and the usability improvements that should guide the product from here.

## Product goal

StatQA should not feel like a generic test-snippet generator. It should guide a user through one serious workflow:

1. describe the product,
2. analyze the real site,
3. generate a complete Playwright TypeScript framework,
4. run the generated checks from the app,
5. review pass/fail evidence,
6. download the ZIP,
7. continue locally with safe secrets and POM-based authenticated flows.

## Current workflow

### Step 1: Prepare context

The user should fill in the required product fields before any generation is possible:

- public application URL,
- application name,
- product context,
- user roles/personas,
- critical flows,
- business rules,
- risk areas,
- target browsers,
- optional confidential non-production test accounts.

Generation should stay blocked until the inputs are strong enough. This protects the output from becoming fake, generic, or impossible to run.

### Step 2: Generate the framework

The user should click **Generate full E2E framework** only after the context checklist is clean.

This action is allowed to be slow. The app should communicate that slow generation is expected because StatQA is doing real work:

- opening the target site,
- collecting evidence,
- asking AI for QA design,
- compiling a strict Playwright framework,
- creating POM files,
- creating generated specs,
- preparing docs and run commands.

### Step 3: Run generated checks from the site

The user should click **Run generated tests from site** before downloading.

The in-app run is a preflight, not a full local CI substitute. Its job is to answer:

- can StatQA open the observed public pages,
- do the generated page contracts pass,
- is the framework worth downloading,
- what should be fixed before export.

### Step 4: Review pass/fail output

If checks pass, the user can download the framework.

If checks fail, the user should not immediately download. They should review:

- inaccessible URL,
- app blocking automation,
- unstable public copy/headings,
- site requiring authentication,
- missing context,
- generated assumption that needs correction.

Then regenerate with improved context.

### Step 5: Download the framework

The ZIP should be downloaded only after generation and review.

The downloaded framework should contain:

- `package.json` with clear Playwright scripts,
- `playwright.config.ts`,
- `pages/BasePage.ts`,
- `pages/PublicPage.ts`,
- `config/testAccounts.ts`,
- `test-data/siteEvidence.ts`,
- `tests/generated/*.spec.ts`,
- `docs/automation-guidelines.md`,
- `docs/secrets-management.md`,
- README with local run instructions.

### Step 6: Continue locally

After download, the user should run:

```bash
npm install
npx playwright install
cp .env.example .env
npm run test:list
npm test
```

For headed debug:

```bash
npm run test:headed:single
```

The user should add real non-production secrets only to `.env`, never to generated source files.

## Final usability changes made

The app now surfaces the workflow in the sidebar so the user always sees the correct order:

1. describe the product,
2. generate the framework,
3. run generated checks,
4. review failures,
5. download and continue locally.

The app already blocks generation when core context is missing. It also includes a confidential account field that is handled as a secret-oriented input and translated into environment placeholders in the generated framework.

## Next improvements after this pass

These should be done next if the project continues:

### 1. True generated-framework execution

Currently the app runs browser preflight checks against observed pages. A stronger version would write the generated ZIP to a temporary server-side folder, install dependencies once in a cached environment, run `npx playwright test`, parse the JSON reporter, and return the real Playwright report.

### 2. Login flow builder

Add a guided login-flow step:

- login URL,
- username selector,
- password selector,
- submit selector,
- successful-login assertion,
- logout/cleanup behavior.

Only then should authenticated specs be generated.

### 3. Visual workflow stepper

Replace the text workflow card with a proper stepper showing:

- Context incomplete,
- Ready to generate,
- Generated,
- Run passed/failed,
- Ready to download.

### 4. Field templates

Add one-click templates for common apps:

- SaaS dashboard,
- e-commerce site,
- marketing site,
- admin portal,
- documentation site.

### 5. Better failure diagnostics

When a run fails, show likely fixes:

- unreachable URL,
- auth wall,
- bot protection,
- missing public content,
- unstable generated assertion,
- SSL/certificate issue.

### 6. Framework quality score explanation

Make the readiness score explain itself with visible criteria instead of a simple percentage.
