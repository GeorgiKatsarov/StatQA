import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const frontendPort = 5187;
const frontendUrl = `http://127.0.0.1:${frontendPort}`;
const apiOrigin = "http://localhost:4000";
const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "content-type": "application/json"
};

let serverProcess;

async function waitForFrontend() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(frontendUrl);
      if (response.ok) {
        return;
      }
    } catch {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
    }
  }

  throw new Error("Frontend dev server did not start in time.");
}

function json(route, body, status = 200) {
  return route.fulfill({
    status,
    headers: corsHeaders,
    body: JSON.stringify(body)
  });
}

function createFixtureState() {
  return {
    tests: [],
    archivedTests: [],
    runs: [],
    schedules: [],
    datasets: []
  };
}

function publicUser() {
  return {
    id: "user-1",
    email: "qa@example.com",
    fullName: "QA Analyst",
    companyName: "StatQA",
    role: "QA Lead",
    websiteUrl: "https://www.qacloud.dev/",
    useCase: "Website QA",
    teamSize: "2-10",
    marketingOptIn: false,
    analysesCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function makeTest(index, payload) {
  const now = new Date().toISOString();
  return {
    id: `test-${index}`,
    projectName: payload.projectName,
    targetUrl: payload.targetUrl,
    title: `Checkout flow test ${index}`,
    riskArea: "Checkout",
    priority: index % 2 === 0 ? "high" : "medium",
    testType: "behavior",
    rationale: "Validate checkout behavior with realistic user actions.",
    steps: ["Open checkout", "Enter customer data", "Submit order"],
    assertions: ["Checkout loads", "Validation is visible", "Order feedback appears"],
    testData: { email: `qa${index}@example.com` },
    sourceContext: payload.riskContext,
    status: "ACTIVE",
    archivedAt: null,
    runs: [],
    createdAt: now,
    updatedAt: now
  };
}

function testSummary(state, projectName) {
  const activeTests = state.tests.filter((item) => item.projectName === projectName && item.status === "ACTIVE");
  const archivedTests = state.archivedTests.filter((item) => item.projectName === projectName);
  const runs = state.runs.filter((item) => item.projectName === projectName);
  const schedules = state.schedules.filter((item) => item.projectName === projectName);

  return {
    activeTests: activeTests.length,
    archivedTests: archivedTests.length,
    totalRuns: runs.length,
    runsByStatus: runs.reduce((totals, run) => {
      totals[run.status] = (totals[run.status] ?? 0) + 1;
      return totals;
    }, {}),
    recentRuns: runs,
    latestTests: activeTests.slice(0, 5),
    schedules
  };
}

function frameworkFixture(payload = {}) {
  const project = {
    applicationName: payload.applicationName || "TaskPilot",
    applicationUrl: payload.applicationUrl || "https://taskpilot.example.test",
    productDescription: payload.productDescription || "Task management app for QA demo.",
    mainRoles: payload.mainRoles || ["Admin", "Manager", "Contributor"],
    criticalFlows: payload.criticalFlows || ["Login", "Create task"],
    businessRules: payload.businessRules || ["Contributors cannot delete projects"],
    riskAreas: payload.riskAreas || ["Authentication", "Permissions"],
    supportedBrowsers: payload.supportedBrowsers || ["chromium", "firefox", "webkit"],
    includeCi: payload.includeCi ?? true,
    portfolioMode: payload.portfolioMode ?? true
  };

  return {
    project,
    testStrategy: {
      objectives: ["Verify critical flows", "Separate manual and automation coverage"],
      riskPriorities: ["Authentication: protect core access", "Permissions: prevent unauthorized actions"],
      automationFocus: ["Login smoke", "Validation checks"],
      manualFocus: ["Exploratory review"],
      assumptions: ["Test credentials are supplied through environment variables"]
    },
    manualTests: [
      {
        id: "TC-AUTH-001",
        feature: "Authentication",
        title: "Manager can sign in with valid credentials",
        objective: "Verify successful sign in.",
        preconditions: ["Manager account exists"],
        testData: ["MANAGER_EMAIL", "MANAGER_PASSWORD"],
        steps: [
          { action: "Open login page", expectedResult: "Login form is visible" },
          { action: "Enter valid credentials", expectedResult: "Credentials are accepted" },
          { action: "Submit form", expectedResult: "Dashboard is shown" }
        ],
        finalExpectedResult: "Manager is authenticated.",
        priority: "critical",
        severity: "blocker",
        testType: "Smoke",
        testLevel: "End-to-end",
        classification: "positive",
        automationSuitability: "automate",
        automationNotes: "Stable smoke candidate.",
        tags: ["auth", "smoke"],
        riskArea: "Authentication",
        testerNotes: "Use test account only."
      }
    ],
    suitability: [
      {
        testCaseId: "TC-AUTH-001",
        recommendation: "automate",
        score: 94,
        reasons: ["Repeatable", "Clear assertion"],
        blockers: [],
        selectorAssumptions: ["Accessible names exist"],
        testDataNeeds: ["MANAGER_EMAIL"],
        maintenanceRisk: "low",
        recommendedAutomationLayer: "ui"
      }
    ],
    files: [
      {
        path: "package.json",
        purpose: "Package scripts",
        language: "json",
        content: JSON.stringify({ scripts: { test: "playwright test" } }, null, 2),
        required: true
      },
      {
        path: "playwright.config.ts",
        purpose: "Playwright config",
        language: "typescript",
        content: "export default {};",
        required: true
      },
      {
        path: "tests/auth/login.spec.ts",
        purpose: "Login tests",
        language: "typescript",
        content: "import { expect, test } from '@playwright/test';\ntest('login', async () => { expect(true).toBe(true); });",
        required: true
      },
      {
        path: "README.md",
        purpose: "Documentation",
        language: "markdown",
        content: "# TaskPilot Playwright Framework",
        required: true
      }
    ],
    validation: {
      exportReady: true,
      blockingErrors: [],
      warnings: []
    },
    generatedAt: new Date().toISOString()
  };
}

async function setupMockApi(page, state) {
  await page.route(`${apiOrigin}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const path = url.pathname;
    const projectName = url.searchParams.get("projectName") || "Default workspace";

    if (method === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    if (method === "GET" && path === "/auth/me") {
      await json(route, { user: publicUser() });
      return;
    }

    if (method === "GET" && path === "/analyses") {
      await json(route, { analyses: [] });
      return;
    }

    if (method === "GET" && path === "/qa/ai/status") {
      await json(route, { groqConfigured: true, model: "llama-3.3-70b-versatile" });
      return;
    }

    if (method === "GET" && path === "/qa/projects") {
      const projects = new Set(["Default workspace"]);
      [...state.tests, ...state.archivedTests, ...state.runs, ...state.schedules, ...state.datasets].forEach((item) => {
        projects.add(item.projectName);
      });
      await json(route, { projects: Array.from(projects).sort() });
      return;
    }

    if (method === "GET" && path === "/qa/framework/demo") {
      await json(route, { framework: frameworkFixture() });
      return;
    }

    if (method === "POST" && path === "/qa/framework/generate") {
      const payload = JSON.parse(request.postData() || "{}");
      await json(route, { framework: frameworkFixture(payload) }, 201);
      return;
    }

    if (method === "GET" && path === "/qa/tests") {
      const status = url.searchParams.get("status") === "ARCHIVED" ? "ARCHIVED" : "ACTIVE";
      const source = status === "ARCHIVED" ? state.archivedTests : state.tests;
      await json(route, { tests: source.filter((item) => item.projectName === projectName && item.status === status) });
      return;
    }

    if (method === "POST" && path === "/qa/tests/generate") {
      const payload = JSON.parse(request.postData() || "{}");
      const created = Array.from({ length: payload.count ?? 2 }, (_, offset) => makeTest(state.tests.length + offset + 1, payload));
      state.tests.unshift(...created);
      await json(route, {
        tests: created,
        meta: { source: "groq" }
      }, 201);
      return;
    }

    if (method === "POST" && /^\/qa\/tests\/[^/]+\/run$/.test(path)) {
      const testId = path.split("/")[3];
      const generatedTest = state.tests.find((item) => item.id === testId);
      const run = {
        id: `run-${state.runs.length + 1}`,
        testId,
        projectName: generatedTest.projectName,
        targetUrl: generatedTest.targetUrl,
        status: "NEEDS_REVIEW",
        summary: `Started behavior run for ${generatedTest.title}`,
        details: {
          jobId: `job-${state.runs.length + 1}`,
          trace: [{ status: "queued", message: "Generated test run was queued." }]
        },
        analysisId: null,
        test: {
          title: generatedTest.title,
          riskArea: generatedTest.riskArea,
          priority: generatedTest.priority,
          testType: generatedTest.testType
        },
        createdAt: new Date().toISOString()
      };
      state.runs.unshift(run);
      await json(route, { run, job: { jobId: run.details.jobId } }, 202);
      return;
    }

    if (method === "GET" && path === "/qa/runs") {
      await json(route, { runs: state.runs.filter((item) => item.projectName === projectName) });
      return;
    }

    if (method === "POST" && /^\/qa\/runs\/[^/]+\/refresh$/.test(path)) {
      const runId = path.split("/")[3];
      const run = state.runs.find((item) => item.id === runId);
      run.status = "PASSED";
      run.summary = "Passed with no findings across 1 scanned page.";
      run.details.trace.push({ status: "PASSED", message: run.summary });
      await json(route, { run });
      return;
    }

    if (method === "POST" && path === "/qa/schedules") {
      const payload = JSON.parse(request.postData() || "{}");
      const generatedTest = state.tests.find((item) => item.id === payload.testId);
      const schedule = {
        id: `schedule-${state.schedules.length + 1}`,
        testId: generatedTest.id,
        projectName: generatedTest.projectName,
        targetUrl: generatedTest.targetUrl,
        frequency: payload.frequency,
        enabled: true,
        nextRunAt: new Date(Date.now() + 86400000).toISOString(),
        lastRunAt: null,
        lastRunId: null,
        test: {
          title: generatedTest.title,
          riskArea: generatedTest.riskArea,
          priority: generatedTest.priority,
          testType: generatedTest.testType
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      state.schedules.unshift(schedule);
      await json(route, { schedule }, 201);
      return;
    }

    if (method === "GET" && path === "/qa/schedules") {
      await json(route, { schedules: state.schedules.filter((item) => item.projectName === projectName) });
      return;
    }

    if (method === "POST" && path === "/qa/schedules/run-due") {
      await json(route, { scanned: 0, started: 0, runs: [] }, 202);
      return;
    }

    if (method === "GET" && path === "/qa/reports/summary") {
      await json(route, { summary: testSummary(state, projectName) });
      return;
    }

    if (method === "POST" && path === "/qa/test-data/generate") {
      const payload = JSON.parse(request.postData() || "{}");
      const savedDataset = {
        id: `dataset-${state.datasets.length + 1}`,
        projectName: payload.projectName,
        targetUrl: payload.targetUrl,
        scenario: payload.scenario,
        fields: payload.fields,
        datasetName: "Checkout synthetic data",
        records: [{ email: "buyer@example.com", fullName: "Buyer One" }],
        usageNotes: ["Use with checkout form validation."],
        source: "groq",
        createdAt: new Date().toISOString()
      };
      state.datasets.unshift(savedDataset);
      await json(route, {
        dataset: {
          datasetName: savedDataset.datasetName,
          records: savedDataset.records,
          usageNotes: savedDataset.usageNotes
        },
        meta: { source: "groq" },
        savedDataset
      }, 201);
      return;
    }

    if (method === "GET" && path === "/qa/test-data") {
      await json(route, { datasets: state.datasets.filter((item) => item.projectName === projectName) });
      return;
    }

    await json(route, { message: `Unhandled test route ${method} ${path}` }, 500);
  });
}

before(async () => {
  serverProcess = spawn(
    process.execPath,
    [resolve(rootDir, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", String(frontendPort)],
    {
      cwd: resolve(rootDir, "frontend"),
      shell: false,
      stdio: "ignore"
    }
  );
  await waitForFrontend();
});

after(() => {
  if (serverProcess) {
    serverProcess.kill();
  }
});

test("QA workspace supports generation, scheduling, run refresh, and exports", async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ acceptDownloads: true });
  const state = createFixtureState();
  await setupMockApi(page, state);
  await page.addInitScript(() => {
    localStorage.setItem("statqa_token", "test-token");
  });

  try {
    await page.goto(frontendUrl);
    await page.getByRole("button", { name: "Manual tests" }).click();
    await page.getByLabel("Workspace").fill("Browser QA Project");
    await page.getByLabel("Target URL").fill("https://www.qacloud.dev/");
    await page.getByLabel("Test count").fill("2");
    await page.getByRole("button", { name: "Generate tests" }).click();

    await assertVisible(page, "Generated 2 tests with Groq");
    await assertVisible(page, "Checkout flow test 1");
    assert.equal(await page.getByText("Open checkout").count(), 0);
    assert.equal(await page.getByRole("button", { name: "Test this case" }).count(), 0);
    assert.equal(await page.getByLabel("Schedule frequency").count(), 0);

    await page.getByRole("button", { name: "Details" }).first().click();
    await assertVisible(page, "Open checkout");

    await page.getByRole("button", { name: "Test the tests" }).click();
    await page.getByLabel("Schedule frequency").selectOption("daily");
    await page.getByRole("button", { name: "Schedule" }).first().click();
    await assertVisible(page, "Scheduled daily QA run");

    await page.getByRole("button", { name: "Test this case" }).first().click();
    await assertVisible(page, "Run started. Job job-1");

    await page.getByRole("button", { name: "Results" }).click();
    await assertVisible(page, "Recent runs");
    await page.getByRole("button", { name: "Refresh result" }).first().click();
    await assertVisible(page, "PASSED - Browser QA Project");

    const [jsonDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export JSON" }).click()
    ]);
    assert.equal(jsonDownload.suggestedFilename(), "statqa-qa-report.json");

    const [markdownDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export Markdown" }).click()
    ]);
    assert.equal(markdownDownload.suggestedFilename(), "statqa-qa-report.md");

    await page.getByRole("button", { name: "Test data" }).click();
    await page.getByRole("button", { name: "Generate data" }).click();
    await assertVisible(page, "Checkout synthetic data");

    const [datasetDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export dataset" }).click()
    ]);
    assert.equal(datasetDownload.suggestedFilename(), "checkout-synthetic-data.json");

    await page.getByRole("button", { name: "Automatic tests" }).click();
    await page.getByRole("button", { name: "Load TaskPilot demo" }).click();
    await assertVisible(page, "Loaded the TaskPilot demo framework package.");
    await page.getByRole("button", { name: "Manual tests Human-executable QA cases" }).click();
    await assertVisible(page, "Manager can sign in with valid credentials");
    await page.getByRole("button", { name: "Download suite" }).click();
    await assertVisible(page, "playwright.config.ts");

    const [frameworkDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download framework + suite" }).click()
    ]);
    assert.equal(frameworkDownload.suggestedFilename(), "taskpilot-playwright-framework.zip");

    await page.getByRole("button", { name: "Continue to test the tests" }).click();
    await assertVisible(page, "Run generated tests against the site");
  } finally {
    await browser.close();
  }
});

async function assertVisible(page, text) {
  try {
    await page.getByText(text).first().waitFor({ state: "visible", timeout: 5000 });
  } catch (error) {
    const bodyText = await page.locator("body").innerText();
    error.message = `${error.message}\n\nPage text:\n${bodyText.slice(0, 3000)}`;
    throw error;
  }
}
