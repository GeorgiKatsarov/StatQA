export type FrameworkLanguage = "typescript" | "json" | "markdown" | "env" | "yaml" | "text";

export interface FrameworkRequest {
  applicationName: string;
  applicationUrl: string;
  productDescription: string;
  mainRoles: string[];
  criticalFlows: string[];
  businessRules: string[];
  riskAreas: string[];
  supportedBrowsers: string[];
  includeCi: boolean;
  portfolioMode: boolean;
}

export interface ManualFrameworkTest {
  id: string;
  feature: string;
  title: string;
  objective: string;
  preconditions: string[];
  testData: string[];
  steps: Array<{ action: string; expectedResult: string }>;
  finalExpectedResult: string;
  priority: "low" | "medium" | "high" | "critical";
  severity: "minor" | "major" | "critical" | "blocker";
  testType: string;
  testLevel: string;
  classification: "positive" | "negative" | "boundary";
  automationSuitability: "automate" | "manual-only" | "needs-clarification";
  automationNotes: string;
  tags: string[];
  riskArea: string;
  testerNotes: string;
}

export interface SuitabilityResult {
  testCaseId: string;
  recommendation: "automate" | "manual-only" | "needs-clarification";
  score: number;
  reasons: string[];
  blockers: string[];
  selectorAssumptions: string[];
  testDataNeeds: string[];
  maintenanceRisk: "low" | "medium" | "high";
  recommendedAutomationLayer: "ui" | "api" | "mixed" | "none";
}

export interface GeneratedFrameworkFile {
  path: string;
  purpose: string;
  language: FrameworkLanguage;
  content: string;
  required: boolean;
}

export interface FrameworkValidation {
  exportReady: boolean;
  blockingErrors: string[];
  warnings: string[];
}

export interface FrameworkBuilderResult {
  project: FrameworkRequest;
  testStrategy: {
    objectives: string[];
    riskPriorities: string[];
    automationFocus: string[];
    manualFocus: string[];
    assumptions: string[];
  };
  manualTests: ManualFrameworkTest[];
  suitability: SuitabilityResult[];
  files: GeneratedFrameworkFile[];
  validation: FrameworkValidation;
  generatedAt: string;
}

const DEFAULT_ROLES = ["Admin", "Manager", "Contributor"];
const DEFAULT_FLOWS = ["Login", "Create task", "Assign task", "Filter dashboard"];
const DEFAULT_RULES = ["Users can access only role-appropriate actions", "Required fields must be validated"];
const DEFAULT_RISKS = ["Authentication", "Permissions", "Data persistence", "Form validation"];
const DEFAULT_BROWSERS = ["chromium", "firefox", "webkit"];

export function normalizeFrameworkRequest(input: Partial<FrameworkRequest>): FrameworkRequest {
  return {
    applicationName: clean(input.applicationName) || "TaskPilot",
    applicationUrl: clean(input.applicationUrl) || "https://taskpilot.example.test",
    productDescription:
      clean(input.productDescription) ||
      "A web application where teams manage projects, assign tasks, update statuses, and monitor dashboard progress.",
    mainRoles: normalizeList(input.mainRoles, DEFAULT_ROLES),
    criticalFlows: normalizeList(input.criticalFlows, DEFAULT_FLOWS),
    businessRules: normalizeList(input.businessRules, DEFAULT_RULES),
    riskAreas: normalizeList(input.riskAreas, DEFAULT_RISKS),
    supportedBrowsers: normalizeList(input.supportedBrowsers, DEFAULT_BROWSERS),
    includeCi: input.includeCi ?? true,
    portfolioMode: input.portfolioMode ?? true
  };
}

export function buildFrameworkPackage(input: Partial<FrameworkRequest>): FrameworkBuilderResult {
  const project = normalizeFrameworkRequest(input);
  const manualTests = createManualTests(project);
  const suitability = createSuitability(manualTests);
  const files = createFrameworkFiles(project, manualTests, suitability);
  const validation = validateFrameworkFiles(files);

  return {
    project,
    testStrategy: {
      objectives: [
        `Verify that ${project.applicationName} supports its critical user flows reliably.`,
        "Separate human-executable manual coverage from stable automation candidates.",
        "Protect high-risk areas with smoke and regression tests before release."
      ],
      riskPriorities: project.riskAreas.map((risk) => `${risk}: prioritize coverage because defects here affect core user trust.`),
      automationFocus: [
        "Stable login and navigation smoke paths",
        "Role-based permission checks with deterministic UI outcomes",
        "Form validation and data persistence flows with controlled test data"
      ],
      manualFocus: [
        "Exploratory review of unclear flows",
        "Subjective layout and content quality checks",
        "Any scenario blocked by missing selectors, CAPTCHA, or third-party dependencies"
      ],
      assumptions: [
        "Dedicated test accounts are available through environment variables.",
        "Primary controls have accessible names or stable data-testid attributes.",
        "Generated TODOs must be reviewed before running against a real environment."
      ]
    },
    manualTests,
    suitability,
    files,
    validation,
    generatedAt: new Date().toISOString()
  };
}

function createManualTests(project: FrameworkRequest): ManualFrameworkTest[] {
  const app = project.applicationName;
  const primaryRole = project.mainRoles[1] ?? project.mainRoles[0] ?? "User";
  const restrictedRole = project.mainRoles.at(-1) ?? "Contributor";
  const mainFlow = project.criticalFlows[1] ?? project.criticalFlows[0] ?? "Create item";

  return [
    {
      id: "TC-AUTH-001",
      feature: "Authentication",
      title: `${primaryRole} can sign in with valid credentials`,
      objective: `Verify that an authorized ${primaryRole.toLowerCase()} can authenticate and reach the main workspace.`,
      preconditions: [`${primaryRole} test account exists`, "User is logged out", `${app} is available at the configured base URL`],
      testData: [`${primaryRole.toUpperCase().replace(/\s+/g, "_")}_EMAIL`, `${primaryRole.toUpperCase().replace(/\s+/g, "_")}_PASSWORD`],
      steps: [
        { action: "Open the login page", expectedResult: "Login form is displayed with email, password, and submit controls" },
        { action: `Enter valid ${primaryRole.toLowerCase()} credentials`, expectedResult: "Fields accept the values and password remains masked" },
        { action: "Submit the login form", expectedResult: "A loading state is shown while authentication is processed" },
        { action: "Wait for navigation to the authenticated area", expectedResult: "Dashboard or main workspace heading is visible" }
      ],
      finalExpectedResult: `${primaryRole} is authenticated and can access ${app}.`,
      priority: "critical",
      severity: "blocker",
      testType: "Smoke, regression",
      testLevel: "End-to-end",
      classification: "positive",
      automationSuitability: "automate",
      automationNotes: "Stable smoke candidate if test credentials and dashboard selectors are available.",
      tags: ["authentication", "smoke", "regression"],
      riskArea: "Authentication",
      testerNotes: "Use dedicated test credentials only. Do not use real personal accounts."
    },
    {
      id: "TC-AUTH-002",
      feature: "Authentication",
      title: "Invalid password shows a generic authentication error",
      objective: "Verify that invalid credentials are rejected without revealing account existence.",
      preconditions: ["User is logged out", "A known test email exists"],
      testData: ["Valid test email", "Invalid password value"],
      steps: [
        { action: "Open the login page", expectedResult: "Login form is visible" },
        { action: "Enter a valid email and invalid password", expectedResult: "Both fields accept the entered values" },
        { action: "Submit the login form", expectedResult: "Authentication request is submitted" },
        { action: "Observe the displayed error", expectedResult: "A generic error such as 'Invalid email or password' is shown" }
      ],
      finalExpectedResult: "User remains unauthenticated and no account-state information is leaked.",
      priority: "high",
      severity: "major",
      testType: "Negative, security",
      testLevel: "End-to-end",
      classification: "negative",
      automationSuitability: "automate",
      automationNotes: "Good deterministic negative test. Confirm exact error copy with product requirements.",
      tags: ["authentication", "negative", "security"],
      riskArea: "Authentication security",
      testerNotes: "Exact copy may differ by implementation; assertion can use a stable approved message."
    },
    {
      id: "TC-FLOW-001",
      feature: mainFlow,
      title: `${primaryRole} can complete ${mainFlow.toLowerCase()} with valid data`,
      objective: `Verify that ${mainFlow.toLowerCase()} works with valid required fields and persists the result.`,
      preconditions: [`${primaryRole} is logged in`, "Required reference data exists"],
      testData: ["Unique title generated at runtime", "Future due date or valid business date", "Active assignee/user where applicable"],
      steps: [
        { action: `Navigate to the ${mainFlow} area`, expectedResult: "The page loads with the primary action visible" },
        { action: "Open the creation or edit form", expectedResult: "Form fields and save action are displayed" },
        { action: "Enter valid required data", expectedResult: "Fields accept the values and no validation errors are shown" },
        { action: "Save the form", expectedResult: "Success feedback is shown and the form closes or navigates to details" },
        { action: "Search or filter for the created record", expectedResult: "The saved record appears with the expected values" }
      ],
      finalExpectedResult: `${mainFlow} succeeds and the result is persisted.`,
      priority: "critical",
      severity: "critical",
      testType: "Functional, regression",
      testLevel: "End-to-end",
      classification: "positive",
      automationSuitability: "automate",
      automationNotes: "Strong automation candidate if test data can be isolated and cleaned up.",
      tags: ["workflow", "persistence", "regression"],
      riskArea: "Data persistence",
      testerNotes: "Confirm setup and cleanup expectations before automating against shared environments."
    },
    {
      id: "TC-VAL-001",
      feature: mainFlow,
      title: `${mainFlow} rejects invalid required-field data`,
      objective: "Verify that validation prevents saving incomplete or invalid data.",
      preconditions: [`${primaryRole} is logged in`, `${mainFlow} form is available`],
      testData: ["Blank required field", "Invalid date or invalid formatted value"],
      steps: [
        { action: `Open the ${mainFlow} form`, expectedResult: "Form is displayed and ready for input" },
        { action: "Leave a required field blank or enter an invalid value", expectedResult: "The field contains invalid data or remains empty" },
        { action: "Attempt to save", expectedResult: "Save is blocked and validation feedback is displayed near the field" },
        { action: "Return to the list or search results", expectedResult: "No invalid record was created" }
      ],
      finalExpectedResult: "Invalid data is rejected and no bad record is persisted.",
      priority: "high",
      severity: "major",
      testType: "Validation, boundary",
      testLevel: "End-to-end",
      classification: "negative",
      automationSuitability: "automate",
      automationNotes: "Use dynamic dates and stable validation message assertions.",
      tags: ["validation", "negative", "boundary"],
      riskArea: "Form validation",
      testerNotes: "Timezone rules should be confirmed for date-related validation."
    },
    {
      id: "TC-PERM-001",
      feature: "Permissions",
      title: `${restrictedRole} cannot perform restricted administrative actions`,
      objective: "Verify that lower-privileged users cannot access restricted actions through UI or direct route attempts.",
      preconditions: [`${restrictedRole} is logged in`, "At least one restricted record exists"],
      testData: [`${restrictedRole} test account`, "Restricted action route if known"],
      steps: [
        { action: `Log in as ${restrictedRole}`, expectedResult: "User lands in the allowed workspace" },
        { action: "Navigate to a page containing restricted actions for higher roles", expectedResult: "Page loads without restricted action controls" },
        { action: "Look for delete, admin, or ownership-transfer action", expectedResult: "Restricted action is hidden or disabled with a clear authorization message" },
        { action: "Attempt direct route access if the route is known", expectedResult: "Application returns unauthorized, forbidden, or not found behavior" }
      ],
      finalExpectedResult: `${restrictedRole} cannot perform restricted actions.`,
      priority: "critical",
      severity: "critical",
      testType: "Permission, security",
      testLevel: "End-to-end",
      classification: "negative",
      automationSuitability: "needs-clarification",
      automationNotes: "UI check is automatable. Direct route behavior needs confirmed route and expected response.",
      tags: ["permissions", "security", "negative"],
      riskArea: "Role-based access control",
      testerNotes: "Confirm expected unauthorized behavior with product/security owner."
    }
  ];
}

function createSuitability(tests: ManualFrameworkTest[]): SuitabilityResult[] {
  return tests.map((test) => {
    if (test.automationSuitability === "automate") {
      return {
        testCaseId: test.id,
        recommendation: "automate",
        score: test.priority === "critical" ? 92 : 86,
        reasons: ["Repeatable flow", "Clear UI assertions", "High regression value"],
        blockers: [],
        selectorAssumptions: ["Primary controls have accessible names or data-testid attributes"],
        testDataNeeds: test.testData,
        maintenanceRisk: "medium",
        recommendedAutomationLayer: "ui"
      };
    }

    return {
      testCaseId: test.id,
      recommendation: "needs-clarification",
      score: 68,
      reasons: ["Important security coverage", "UI visibility check is automatable"],
      blockers: ["Direct route and expected authorization response are not confirmed"],
      selectorAssumptions: ["Restricted action selector or route must be confirmed"],
      testDataNeeds: test.testData,
      maintenanceRisk: "medium",
      recommendedAutomationLayer: "mixed"
    };
  });
}

function createFrameworkFiles(
  project: FrameworkRequest,
  tests: ManualFrameworkTest[],
  suitability: SuitabilityResult[]
): GeneratedFrameworkFile[] {
  const automatedTests = tests.filter((test) => suitability.find((item) => item.testCaseId === test.id)?.recommendation === "automate");
  const files: GeneratedFrameworkFile[] = [
    frameworkFile("package.json", "Package scripts and Playwright dependencies.", "json", packageJson(project)),
    frameworkFile("tsconfig.json", "TypeScript configuration for generated framework.", "json", tsconfigJson()),
    frameworkFile("playwright.config.ts", "Playwright browsers, reporters, traces, screenshots, and videos.", "typescript", playwrightConfig(project)),
    frameworkFile(".env.example", "Placeholder environment variables. Never commit real secrets.", "env", envExample(project)),
    frameworkFile(".gitignore", "Ignore local dependencies, env files, and reports.", "text", gitignore()),
    frameworkFile("README.md", "Professional setup and usage documentation.", "markdown", readme(project)),
    frameworkFile("config/testMetadata.ts", "Project-level metadata used in reports and docs.", "typescript", testMetadata(project)),
    frameworkFile("data/users.ts", "Environment-backed test user definitions.", "typescript", userData(project)),
    frameworkFile("data/manualTestCases.json", "Structured manual test cases used as traceability source.", "json", JSON.stringify(tests, null, 2)),
    frameworkFile("docs/manual-test-cases.md", "Human-executable manual test cases.", "markdown", manualTestsDoc(tests)),
    frameworkFile("docs/test-strategy.md", "Risk-based QA strategy and assumptions.", "markdown", strategyDoc(project)),
    frameworkFile("docs/automation-decisions.md", "Automation suitability decisions.", "markdown", automationDoc(tests, suitability)),
    frameworkFile("fixtures/auth.fixture.ts", "Authenticated Playwright fixtures for common roles.", "typescript", authFixture()),
    frameworkFile("pages/LoginPage.ts", "Login page object.", "typescript", loginPageObject()),
    frameworkFile("pages/DashboardPage.ts", "Dashboard readiness page object.", "typescript", dashboardPageObject()),
    frameworkFile("pages/CoreWorkflowPage.ts", "Generic workflow page object with TODO hooks for app-specific selectors.", "typescript", coreWorkflowPageObject()),
    frameworkFile("utils/env.ts", "Required environment variable helper.", "typescript", envHelper()),
    frameworkFile("utils/dateUtils.ts", "Date helpers for validation and boundary tests.", "typescript", dateUtils()),
    frameworkFile("tests/auth/login.spec.ts", "Generated authentication smoke and negative tests.", "typescript", authSpec())
  ];

  if (automatedTests.some((test) => test.id.startsWith("TC-FLOW") || test.id.startsWith("TC-VAL"))) {
    files.push(frameworkFile("tests/workflows/core-flow.spec.ts", "Generated core workflow regression tests.", "typescript", workflowSpec(project)));
  }

  if (project.includeCi) {
    files.push(frameworkFile(".github/workflows/playwright.yml", "Optional GitHub Actions workflow.", "yaml", githubWorkflow()));
  }

  if (project.portfolioMode) {
    files.push(frameworkFile("docs/interview-demo-script.md", "Portfolio mode interview walkthrough.", "markdown", interviewScript(project)));
  }

  return files;
}

function frameworkFile(path: string, purpose: string, language: FrameworkLanguage, content: string): GeneratedFrameworkFile {
  return { path, purpose, language, content, required: true };
}

function validateFrameworkFiles(files: GeneratedFrameworkFile[]): FrameworkValidation {
  const blockingErrors: string[] = [];
  const warnings: string[] = [];
  const paths = new Set<string>();
  const required = ["package.json", "tsconfig.json", "playwright.config.ts", ".env.example", ".gitignore", "README.md"];

  for (const file of files) {
    if (!file.path || file.path.includes("..") || file.path.startsWith("/") || /^[a-z]:/i.test(file.path)) {
      blockingErrors.push(`Unsafe file path: ${file.path}`);
    }
    if (paths.has(file.path)) {
      blockingErrors.push(`Duplicate file path: ${file.path}`);
    }
    paths.add(file.path);
    if (file.content.includes("waitForTimeout")) {
      warnings.push(`Avoid arbitrary waits in ${file.path}`);
    }
    if (file.path.endsWith(".spec.ts") && !file.content.includes("expect(")) {
      warnings.push(`Spec file has no visible assertion: ${file.path}`);
    }
  }

  for (const requiredPath of required) {
    if (!paths.has(requiredPath)) {
      blockingErrors.push(`Missing required file: ${requiredPath}`);
    }
  }

  if (![...paths].some((path) => path.startsWith("tests/") && path.endsWith(".spec.ts"))) {
    blockingErrors.push("At least one Playwright spec file is required.");
  }

  return { exportReady: blockingErrors.length === 0, blockingErrors, warnings };
}

function clean(value?: string): string {
  return value?.trim() ?? "";
}

function normalizeList(value: string[] | undefined, fallback: string[]): string[] {
  const cleaned = (value ?? []).map((item) => item.trim()).filter(Boolean);
  return cleaned.length ? cleaned : fallback;
}

function packageJson(project: FrameworkRequest): string {
  return JSON.stringify(
    {
      name: `${slug(project.applicationName)}-playwright-framework`,
      version: "1.0.0",
      private: true,
      scripts: {
        test: "playwright test",
        "test:headed": "playwright test --headed",
        "test:ui": "playwright test --ui",
        "test:chromium": "playwright test --project=chromium",
        "test:firefox": "playwright test --project=firefox",
        "test:webkit": "playwright test --project=webkit",
        "test:smoke": "playwright test --grep @smoke",
        "test:regression": "playwright test --grep @regression",
        report: "playwright show-report reports/html-report"
      },
      devDependencies: {
        "@playwright/test": "^1.52.0",
        "@types/node": "^22.0.0",
        dotenv: "^16.4.5",
        typescript: "^5.8.3"
      }
    },
    null,
    2
  );
}

function tsconfigJson(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "CommonJS",
        moduleResolution: "Node",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        types: ["node", "@playwright/test"],
        noEmit: true
      },
      include: ["tests", "pages", "fixtures", "data", "utils", "config"]
    },
    null,
    2
  );
}

function playwrightConfig(project: FrameworkRequest): string {
  const browserProjects = project.supportedBrowsers.map((browser) => `    { name: "${browser}" }`).join(",\n");
  return `import { defineConfig } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "reports/html-report", open: "never" }],
    ...(process.env.CI ? [["junit", { outputFile: "reports/junit/results.xml" }] as const] : [])
  ],
  use: {
    baseURL: process.env.BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
${browserProjects}
  ]
});
`;
}

function envExample(project: FrameworkRequest): string {
  return `BASE_URL=${project.applicationUrl}
MANAGER_EMAIL=manager.test@example.com
MANAGER_PASSWORD=replace-with-test-password
CONTRIBUTOR_EMAIL=contributor.test@example.com
CONTRIBUTOR_PASSWORD=replace-with-test-password
`;
}

function gitignore(): string {
  return `node_modules/
.env
test-results/
playwright-report/
reports/
blob-report/
*.log
`;
}

function readme(project: FrameworkRequest): string {
  return `# ${project.applicationName} Playwright Framework

Generated by StatQA Framework Builder.

## Purpose

This framework automates stable smoke and regression candidates for ${project.applicationName}. Manual-only and needs-clarification tests are documented in \`docs/automation-decisions.md\`.

## Prerequisites

- Node.js 20+
- Access to a non-production test environment
- Dedicated test credentials

## Install

\`\`\`bash
npm install
npx playwright install
\`\`\`

## Environment

Copy \`.env.example\` to \`.env\` and replace placeholder values with dedicated test accounts.

## Run

\`\`\`bash
npm test
npm run test:headed
npm run test:ui
npm run test:smoke
npm run test:regression
npm run report
\`\`\`

## Reporting

HTML reports are written to \`reports/html-report\`. Screenshots, videos, and traces are retained for failures or retries according to \`playwright.config.ts\`.

## Assumptions

- Accessible names or stable \`data-testid\` values exist for important controls.
- Credentials are supplied through environment variables.
- TODO selectors must be confirmed before using this against a real app.

## Traceability

- Manual source cases: \`docs/manual-test-cases.md\`
- Automation decisions: \`docs/automation-decisions.md\`
- Machine-readable manual cases: \`data/manualTestCases.json\`
`;
}

function testMetadata(project: FrameworkRequest): string {
  return `export const testMetadata = {
  applicationName: ${JSON.stringify(project.applicationName)},
  baseUrl: process.env.BASE_URL,
  supportedBrowsers: ${JSON.stringify(project.supportedBrowsers, null, 2)},
  generatedBy: "StatQA Framework Builder",
  riskAreas: ${JSON.stringify(project.riskAreas, null, 2)}
} as const;
`;
}

function userData(project: FrameworkRequest): string {
  const roleConstants = project.mainRoles.map((role) => {
    const key = role.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
    return `  ${key}: {
    role: ${JSON.stringify(role)},
    emailEnv: "${key}_EMAIL",
    passwordEnv: "${key}_PASSWORD"
  }`;
  });

  return `export const testUsers = {
${roleConstants.join(",\n")}
} as const;
`;
}

function manualTestsDoc(tests: ManualFrameworkTest[]): string {
  return [
    "# Manual Test Cases",
    "",
    "These cases are written for human QA execution. Automation should reference these cases but not replace tester review.",
    "",
    ...tests.flatMap((test) => [
      `## ${test.id}: ${test.title}`,
      "",
      `Feature: ${test.feature}`,
      "",
      `Objective: ${test.objective}`,
      "",
      `Priority: ${test.priority}`,
      "",
      `Severity: ${test.severity}`,
      "",
      "### Preconditions",
      "",
      ...test.preconditions.map((item) => `- ${item}`),
      "",
      "### Test Data",
      "",
      ...test.testData.map((item) => `- ${item}`),
      "",
      "### Steps",
      "",
      ...test.steps.map((step, index) => `${index + 1}. ${step.action}\n   Expected: ${step.expectedResult}`),
      "",
      `Final expected result: ${test.finalExpectedResult}`,
      "",
      `Automation notes: ${test.automationNotes}`,
      ""
    ])
  ].join("\n");
}

function strategyDoc(project: FrameworkRequest): string {
  return `# Test Strategy

## Objectives

- Verify critical flows: ${project.criticalFlows.join(", ")}.
- Protect high-risk areas: ${project.riskAreas.join(", ")}.
- Keep manual testing and automation connected but separate.

## Manual Focus

- Exploratory review
- Subjective visual quality
- Flows with missing selectors or unclear expected results

## Automation Focus

- Smoke login
- Regression flows
- Validation and permission checks with deterministic assertions
`;
}

function automationDoc(tests: ManualFrameworkTest[], suitability: SuitabilityResult[]): string {
  return [
    "# Automation Decisions",
    "",
    "| Test | Recommendation | Score | Notes |",
    "| --- | --- | ---: | --- |",
    ...tests.map((test) => {
      const decision = suitability.find((item) => item.testCaseId === test.id);
      return `| ${test.id} ${test.title} | ${decision?.recommendation ?? "manual-only"} | ${decision?.score ?? 0} | ${test.automationNotes.replace(/\|/g, "/")} |`;
    })
  ].join("\n");
}

function loginPageObject(): string {
  return `import { Page, Locator, expect } from "@playwright/test";

export class LoginPage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly authError: Locator;

  constructor(private readonly page: Page) {
    this.emailInput = page.getByLabel(/email/i);
    this.passwordInput = page.getByLabel(/password/i);
    this.submitButton = page.getByRole("button", { name: /sign in|log in/i });
    this.authError = page.getByRole("alert").or(page.getByText(/invalid email or password/i));
  }

  async goto(): Promise<void> {
    await this.page.goto("/login");
    await expect(this.submitButton).toBeVisible();
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
`;
}

function dashboardPageObject(): string {
  return `import { Page, Locator } from "@playwright/test";

export class DashboardPage {
  readonly heading: Locator;
  readonly userMenu: Locator;

  constructor(page: Page) {
    this.heading = page.getByRole("heading", { name: /dashboard|workspace/i });
    this.userMenu = page.getByRole("button", { name: /account|profile|user menu/i });
  }
}
`;
}

function coreWorkflowPageObject(): string {
  return `import { Page, Locator, expect } from "@playwright/test";

export class CoreWorkflowPage {
  readonly mainRegion: Locator;

  constructor(private readonly page: Page) {
    this.mainRegion = page.getByRole("main").or(page.locator("body"));
  }

  async goto(path: string): Promise<void> {
    await this.page.goto(path);
    await expect(this.mainRegion).toBeVisible();
  }

  async openPrimaryAction(name: RegExp): Promise<void> {
    await this.page.getByRole("button", { name }).click();
  }

  async save(name = /save|create|submit/i): Promise<void> {
    await this.page.getByRole("button", { name }).click();
  }

  async assertRecordVisible(text: string | RegExp): Promise<void> {
    await expect(this.page.getByText(text)).toBeVisible();
  }
}
`;
}

function authFixture(): string {
  return `import { test as base } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage";
import { getRequiredEnv } from "../utils/env";

type AuthFixtures = {
  signInAsManager: () => Promise<void>;
};

export const test = base.extend<AuthFixtures>({
  signInAsManager: async ({ page }, use) => {
    await use(async () => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.signIn(getRequiredEnv("MANAGER_EMAIL"), getRequiredEnv("MANAGER_PASSWORD"));
    });
  }
});

export { expect } from "@playwright/test";
`;
}

function envHelper(): string {
  return `export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(\`Missing required environment variable: \${name}\`);
  }
  return value;
}
`;
}

function dateUtils(): string {
  return `export function getFutureDate(daysFromToday: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
}

export function getPastDate(daysBeforeToday: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysBeforeToday);
  return date.toISOString().slice(0, 10);
}
`;
}

function authSpec(): string {
  return `import { test, expect } from "@playwright/test";
import { LoginPage } from "../../pages/LoginPage";
import { DashboardPage } from "../../pages/DashboardPage";
import { getRequiredEnv } from "../../utils/env";

test.describe("Authentication @smoke @regression", () => {
  test("manager can sign in with valid credentials", async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    await loginPage.goto();
    await loginPage.signIn(getRequiredEnv("MANAGER_EMAIL"), getRequiredEnv("MANAGER_PASSWORD"));

    await expect(dashboardPage.heading).toBeVisible();
  });

  test("invalid password shows generic authentication error", async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.signIn(getRequiredEnv("MANAGER_EMAIL"), "WrongPassword123!");

    await expect(loginPage.authError).toBeVisible();
    await expect(page).toHaveURL(/login/);
  });
});
`;
}

function workflowSpec(project: FrameworkRequest): string {
  const flow = project.criticalFlows[1] ?? project.criticalFlows[0] ?? "core workflow";
  return `import { test, expect } from "@playwright/test";
import { LoginPage } from "../../pages/LoginPage";
import { getRequiredEnv } from "../../utils/env";

test.describe("${flow} @regression", () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.signIn(getRequiredEnv("MANAGER_EMAIL"), getRequiredEnv("MANAGER_PASSWORD"));
  });

  test("${flow.toLowerCase()} page is reachable for authorized user", async ({ page }) => {
    // TODO: Confirm the exact route and heading for ${flow}.
    await page.goto("/");
    await expect(page.getByRole("main").or(page.locator("body"))).toBeVisible();
  });
});
`;
}

function githubWorkflow(): string {
  return `name: Playwright Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm test
        env:
          BASE_URL: \${{ secrets.BASE_URL }}
          MANAGER_EMAIL: \${{ secrets.MANAGER_EMAIL }}
          MANAGER_PASSWORD: \${{ secrets.MANAGER_PASSWORD }}
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-html-report
          path: reports/html-report
`;
}

function interviewScript(project: FrameworkRequest): string {
  return `# Interview Demo Script

1. Introduce ${project.applicationName} and its critical flows.
2. Explain why manual tests are generated before automation.
3. Show the automation suitability table and one needs-clarification decision.
4. Open \`tests/auth/login.spec.ts\` and explain Playwright assertions.
5. Open \`pages/LoginPage.ts\` and explain the page object boundary.
6. Run \`npm test\` and open the HTML report.
7. Discuss assumptions and next improvements honestly.
`;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "generated";
}
