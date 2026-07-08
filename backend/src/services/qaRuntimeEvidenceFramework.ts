import { chromium, type Browser, type Locator, type Page } from "playwright";
import { callGroqJson } from "./groq.js";

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

export interface SiteTextEvidence {
  text: string;
}

export interface SitePageEvidence {
  url: string;
  path: string;
  title: string;
  status: number | null;
  headings: SiteTextEvidence[];
  buttons: SiteTextEvidence[];
  links: Array<{ text: string; href: string; internal: boolean }>;
  inputs: Array<{ type: string; name?: string; label?: string; placeholder?: string }>;
  forms: Array<{ name: string; inputs: Array<{ type: string; name?: string; placeholder?: string }>; submitLabels: string[] }>;
  textSnippets: string[];
}

export interface SiteEvidence {
  targetUrl: string;
  origin: string;
  analyzedAt: string;
  status: "ok" | "partial" | "failed";
  error?: string;
  pages: SitePageEvidence[];
  discoveredInternalLinks: string[];
  summary: {
    pagesAnalyzed: number;
    formsFound: number;
    inputsFound: number;
    buttonsFound: number;
    internalLinksFound: number;
  };
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
  siteEvidence: SiteEvidence;
  quality: {
    readinessScore: number;
    runnableSpecCount: number;
    evidenceBackedAssertions: number;
    aiBlueprintsUsed: number;
  };
}

interface AutomationAssertion {
  kind: "page-load" | "title-contains" | "body-contains" | "heading-visible" | "button-visible" | "link-visible" | "internal-link-ok";
  value?: string;
  href?: string;
}

interface AutomationBlueprint {
  id: string;
  testCaseId: string;
  title: string;
  pageUrl: string;
  tags: string[];
  assertions: AutomationAssertion[];
}

const DEFAULT_ROLES = ["Visitor"];
const DEFAULT_FLOWS = ["Load public pages", "Navigate internal links", "Review visible forms"];
const DEFAULT_RULES = ["Public pages should load successfully", "Observed links should remain reachable"];
const DEFAULT_RISKS = ["Broken navigation", "Missing primary content", "Form validation", "Regression risk"];
const DEFAULT_BROWSERS = ["chromium", "firefox", "webkit"];
const MAX_ANALYZED_PAGES = 5;

export function normalizeFrameworkRequest(input: Partial<FrameworkRequest>): FrameworkRequest {
  const applicationUrl = clean(input.applicationUrl);
  if (!applicationUrl) {
    throw new Error("A real application URL is required before StatQA can generate a runnable Playwright framework.");
  }

  new URL(applicationUrl);

  return {
    applicationName: clean(input.applicationName) || hostnameLabel(applicationUrl),
    applicationUrl,
    productDescription:
      clean(input.productDescription) ||
      "Public website QA coverage generated from observed pages, visible content, links, forms, and safe browser checks.",
    mainRoles: normalizeList(input.mainRoles, DEFAULT_ROLES),
    criticalFlows: normalizeList(input.criticalFlows, DEFAULT_FLOWS),
    businessRules: normalizeList(input.businessRules, DEFAULT_RULES),
    riskAreas: normalizeList(input.riskAreas, DEFAULT_RISKS),
    supportedBrowsers: normalizeList(input.supportedBrowsers, DEFAULT_BROWSERS),
    includeCi: input.includeCi ?? true,
    portfolioMode: input.portfolioMode ?? true
  };
}

export async function buildFrameworkPackage(input: Partial<FrameworkRequest>): Promise<FrameworkBuilderResult> {
  const project = normalizeFrameworkRequest(input);
  const siteEvidence = await collectSiteEvidence(project.applicationUrl);
  const manualTests = await generateManualTestsWithAI(project, siteEvidence);
  const suitability = createSuitability(manualTests, siteEvidence);
  const blueprints = await generateAutomationBlueprintsWithAI(project, siteEvidence, manualTests, suitability);
  const files = createFrameworkFiles(project, siteEvidence, manualTests, suitability, blueprints);
  const validation = validateFrameworkFiles(files, siteEvidence);

  return {
    project,
    testStrategy: createTestStrategy(project, siteEvidence),
    manualTests,
    suitability,
    files,
    validation,
    generatedAt: new Date().toISOString(),
    siteEvidence,
    quality: calculateQuality(siteEvidence, blueprints, validation)
  };
}

async function collectSiteEvidence(targetUrl: string): Promise<SiteEvidence> {
  const origin = new URL(targetUrl).origin;
  const discoveredInternalLinks = new Set<string>([targetUrl]);
  const pages: SitePageEvidence[] = [];
  const visited = new Set<string>();
  const queue = [targetUrl];
  let browser: Browser | undefined;
  let lastError: string | undefined;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1366, height: 900 } });

    while (queue.length && pages.length < MAX_ANALYZED_PAGES) {
      const currentUrl = queue.shift();
      if (!currentUrl || visited.has(currentUrl)) continue;
      visited.add(currentUrl);

      const page = await context.newPage();
      try {
        const evidence = await inspectPage(page, currentUrl, origin);
        pages.push(evidence);

        for (const link of evidence.links) {
          if (!link.internal) continue;
          const normalized = normalizeUrl(link.href);
          if (normalized && !visited.has(normalized) && queue.length + pages.length < MAX_ANALYZED_PAGES) {
            discoveredInternalLinks.add(normalized);
            queue.push(normalized);
          }
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Unable to inspect page.";
      } finally {
        await page.close().catch(() => undefined);
      }
    }

    await context.close();
  } catch (error) {
    lastError = error instanceof Error ? error.message : "Unable to launch Playwright analysis.";
  } finally {
    await browser?.close().catch(() => undefined);
  }

  return {
    targetUrl,
    origin,
    analyzedAt: new Date().toISOString(),
    status: pages.length ? (lastError ? "partial" : "ok") : "failed",
    error: lastError,
    pages,
    discoveredInternalLinks: Array.from(discoveredInternalLinks),
    summary: {
      pagesAnalyzed: pages.length,
      formsFound: pages.reduce((sum, page) => sum + page.forms.length, 0),
      inputsFound: pages.reduce((sum, page) => sum + page.inputs.length, 0),
      buttonsFound: pages.reduce((sum, page) => sum + page.buttons.length, 0),
      internalLinksFound: Array.from(discoveredInternalLinks).length
    }
  };
}

async function inspectPage(page: Page, url: string, origin: string): Promise<SitePageEvidence> {
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 18_000 });
  await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => undefined);

  const finalUrl = page.url();
  const final = new URL(finalUrl);
  const title = clean(await page.title().catch(() => ""));
  const headings = (await visibleTexts(page.locator("h1, h2, h3"), 12)).map((text) => ({ text }));
  const buttons = (await visibleTexts(page.locator("button, [role='button'], input[type='submit'], input[type='button']"), 12)).map((text) => ({ text }));
  const links = await collectLinks(page, origin);
  const inputs = await collectInputs(page.locator("input, textarea, select"));
  const forms = await collectForms(page);
  const bodyText = clean(await page.locator("body").innerText({ timeout: 2_000 }).catch(() => ""));
  const textSnippets = uniqueStrings(
    bodyText
      .split(/(?<=[.!?])\s+|\n+/)
      .map((text) => text.slice(0, 180))
      .filter((text) => text.length >= 20)
  ).slice(0, 12);

  return {
    url: finalUrl,
    path: `${final.pathname}${final.search}` || "/",
    title,
    status: response?.status() ?? null,
    headings,
    buttons,
    links,
    inputs,
    forms,
    textSnippets
  };
}

async function visibleTexts(locator: Locator, limit: number): Promise<string[]> {
  const count = Math.min(await locator.count().catch(() => 0), limit * 3);
  const values: string[] = [];

  for (let index = 0; index < count && values.length < limit; index += 1) {
    const item = locator.nth(index);
    const visible = await item.isVisible({ timeout: 500 }).catch(() => false);
    if (!visible) continue;
    const text = clean(await item.textContent({ timeout: 500 }).catch(() => ""));
    const aria = clean(await item.getAttribute("aria-label", { timeout: 500 }).catch(() => null) ?? "");
    const title = clean(await item.getAttribute("title", { timeout: 500 }).catch(() => null) ?? "");
    const placeholder = clean(await item.getAttribute("placeholder", { timeout: 500 }).catch(() => null) ?? "");
    const value = text || aria || title || placeholder;
    if (value) values.push(value.slice(0, 120));
  }

  return uniqueStrings(values);
}

async function collectLinks(page: Page, origin: string): Promise<SitePageEvidence["links"]> {
  const links = page.locator("a[href]");
  const count = Math.min(await links.count().catch(() => 0), 40);
  const results: SitePageEvidence["links"] = [];

  for (let index = 0; index < count && results.length < 30; index += 1) {
    const link = links.nth(index);
    const visible = await link.isVisible({ timeout: 500 }).catch(() => false);
    if (!visible) continue;
    const href = normalizeHref(await link.getAttribute("href", { timeout: 500 }).catch(() => null), page.url());
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:")) continue;
    const text = clean(await link.textContent({ timeout: 500 }).catch(() => "")) || href;
    results.push({ text: text.slice(0, 120), href, internal: safeSameOrigin(href, origin) });
  }

  const seen = new Set<string>();
  return results.filter((link) => {
    const key = `${link.text}|${link.href}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function collectInputs(locator: Locator): Promise<SitePageEvidence["inputs"]> {
  const count = Math.min(await locator.count().catch(() => 0), 20);
  const inputs: SitePageEvidence["inputs"] = [];

  for (let index = 0; index < count; index += 1) {
    const input = locator.nth(index);
    const visible = await input.isVisible({ timeout: 500 }).catch(() => false);
    if (!visible) continue;
    inputs.push({
      type: clean(await input.getAttribute("type", { timeout: 500 }).catch(() => null) ?? "") || "text",
      name: optional(await input.getAttribute("name", { timeout: 500 }).catch(() => null)),
      label: optional(await input.getAttribute("aria-label", { timeout: 500 }).catch(() => null)),
      placeholder: optional(await input.getAttribute("placeholder", { timeout: 500 }).catch(() => null))
    });
  }

  return inputs;
}

async function collectForms(page: Page): Promise<SitePageEvidence["forms"]> {
  const forms = page.locator("form");
  const count = Math.min(await forms.count().catch(() => 0), 8);
  const results: SitePageEvidence["forms"] = [];

  for (let index = 0; index < count; index += 1) {
    const form = forms.nth(index);
    const visible = await form.isVisible({ timeout: 500 }).catch(() => false);
    if (!visible) continue;
    const name = optional(await form.getAttribute("name", { timeout: 500 }).catch(() => null)) ?? `Form ${index + 1}`;
    const inputs = await collectInputs(form.locator("input, textarea, select"));
    const submitLabels = await visibleTexts(form.locator("button, input[type='submit']"), 5);
    results.push({ name, inputs, submitLabels });
  }

  return results;
}

async function generateManualTestsWithAI(project: FrameworkRequest, evidence: SiteEvidence): Promise<ManualFrameworkTest[]> {
  const fallback = createFallbackManualTests(project, evidence);
  if (!evidence.pages.length) return fallback;

  try {
    const result = await callGroqJson([
      {
        role: "system",
        content: "You are a senior QA engineer. Generate manual test cases only from observed website evidence. Do not invent routes, hidden auth flows, selectors, data, or private app behavior. Return valid JSON only."
      },
      {
        role: "user",
        content: `Generate 8-12 manual tests from this observed site evidence. Return only a JSON array.\n\nProject: ${JSON.stringify(project)}\nEvidence: ${JSON.stringify(compactEvidence(evidence))}`
      }
    ]);

    const tests = Array.isArray(result) ? result : (result as { tests?: unknown[] }).tests ?? [];
    const normalized = tests.map(normalizeManualTest).filter((test): test is ManualFrameworkTest => Boolean(test));
    return normalized.length ? normalized.slice(0, 12) : fallback;
  } catch {
    return fallback;
  }
}

async function generateAutomationBlueprintsWithAI(project: FrameworkRequest, evidence: SiteEvidence, tests: ManualFrameworkTest[], suitability: SuitabilityResult[]): Promise<AutomationBlueprint[]> {
  const fallback = createFallbackBlueprints(evidence, tests, suitability);
  const automatableTests = tests.filter((test) => suitability.some((item) => item.testCaseId === test.id && item.recommendation === "automate"));
  if (!evidence.pages.length || !automatableTests.length) return fallback;

  try {
    const result = await callGroqJson([
      {
        role: "system",
        content: "You are a Playwright architect. Create automation blueprints only from observed evidence. Do not invent selectors, routes, credentials, clicks, or data. Return valid JSON only."
      },
      {
        role: "user",
        content: `Create automation blueprints from observed evidence and automatable tests. Allowed assertion kinds: page-load, title-contains, body-contains, heading-visible, button-visible, link-visible, internal-link-ok. Return JSON: { "tests": [{ "id": "AUTO-EVIDENCE-001", "testCaseId": "TC-EVIDENCE-001", "title": "Readable title", "pageUrl": "observed URL", "tags": ["smoke"], "assertions": [{ "kind": "page-load" }] }] }.\n\nProject: ${JSON.stringify(project)}\nEvidence: ${JSON.stringify(compactEvidence(evidence))}\nManual tests: ${JSON.stringify(automatableTests)}`
      }
    ]);

    const rawTests = Array.isArray((result as { tests?: unknown[] }).tests) ? (result as { tests: unknown[] }).tests : [];
    const blueprints = rawTests.map((item) => normalizeBlueprint(item, evidence, automatableTests)).filter((blueprint): blueprint is AutomationBlueprint => Boolean(blueprint));
    return blueprints.length ? blueprints.slice(0, 12) : fallback;
  } catch {
    return fallback;
  }
}

function createFrameworkFiles(project: FrameworkRequest, evidence: SiteEvidence, tests: ManualFrameworkTest[], suitability: SuitabilityResult[], blueprints: AutomationBlueprint[]): GeneratedFrameworkFile[] {
  const files: GeneratedFrameworkFile[] = [
    frameworkFile("package.json", "Playwright package with useful scripts.", "json", packageJson(project)),
    frameworkFile("tsconfig.json", "TypeScript configuration.", "json", tsconfigJson()),
    frameworkFile("playwright.config.ts", "Playwright browser and report configuration.", "typescript", playwrightConfig(project)),
    frameworkFile(".env.example", "Target URL environment configuration.", "env", `BASE_URL=${new URL(project.applicationUrl).origin}\n`),
    frameworkFile(".gitignore", "Ignored local files and reports.", "text", gitignore()),
    frameworkFile("README.md", "Generated framework setup guide.", "markdown", readme(project, evidence, blueprints)),
    frameworkFile("statqa-framework-manifest.json", "Machine-readable generated framework manifest.", "json", JSON.stringify(createManifest(project, evidence, tests, blueprints), null, 2)),
    frameworkFile("data/siteEvidence.json", "Observed site evidence used for generation.", "json", JSON.stringify(evidence, null, 2)),
    frameworkFile("data/manualTestCases.json", "Generated manual test cases.", "json", JSON.stringify(tests, null, 2)),
    frameworkFile("data/automationBlueprints.json", "AI-selected automation blueprints.", "json", JSON.stringify(blueprints, null, 2)),
    frameworkFile("docs/site-analysis.md", "Human-readable site analysis evidence.", "markdown", siteAnalysisDoc(evidence)),
    frameworkFile("docs/manual-test-cases.md", "Manual source test cases.", "markdown", manualTestsDoc(tests)),
    frameworkFile("docs/automation-decisions.md", "Automation suitability decisions.", "markdown", automationDoc(tests, suitability)),
    frameworkFile("docs/test-strategy.md", "Evidence-backed testing strategy.", "markdown", strategyDoc(project, evidence)),
    frameworkFile("docs/quality-checklist.md", "Framework review checklist.", "markdown", qualityChecklist()),
    frameworkFile("config/testMetadata.ts", "Project metadata used by tests.", "typescript", testMetadata(project, evidence)),
    frameworkFile("utils/env.ts", "Environment variable helper.", "typescript", envHelper()),
    frameworkFile("pages/PublicPage.ts", "Reusable public page object.", "typescript", publicPageObject()),
    frameworkFile("tests/generated/site-evidence.spec.ts", "Runnable evidence-backed Playwright tests.", "typescript", generatedSiteEvidenceSpec(project, evidence, blueprints))
  ];

  if (project.includeCi) files.push(frameworkFile(".github/workflows/playwright.yml", "GitHub Actions workflow.", "yaml", githubWorkflow()));
  if (project.portfolioMode) files.push(frameworkFile("docs/interview-demo-script.md", "Portfolio walkthrough script.", "markdown", interviewScript(project)));
  return files;
}

function createFallbackManualTests(project: FrameworkRequest, evidence: SiteEvidence): ManualFrameworkTest[] {
  const firstPage = evidence.pages[0];
  if (!firstPage) {
    return [manualTest({ id: "TC-EVIDENCE-001", title: "Target site needs accessible public evidence before automation", feature: "Environment access", objective: "Document that automation is blocked until StatQA can observe at least one public page.", automationSuitability: "manual-only", testerNotes: evidence.error ?? "No public page evidence was collected." })];
  }

  const tests: ManualFrameworkTest[] = [manualTest({ id: "TC-EVIDENCE-001", title: `${project.applicationName} public entry page loads successfully`, feature: "Public availability", objective: "Verify that the observed public entry page responds and renders stable content.", priority: "critical", severity: "blocker", automationSuitability: "automate", tags: ["smoke", "regression", "public-page"], riskArea: "Public availability" })];

  for (const page of evidence.pages.slice(1, 5)) {
    tests.push(manualTest({ id: `TC-EVIDENCE-${String(tests.length + 1).padStart(3, "0")}`, title: `Observed internal page remains reachable: ${page.path}`, feature: "Internal navigation", objective: "Verify that an internally discovered public page continues to load and render observed content.", priority: "high", severity: "major", automationSuitability: "automate", tags: ["navigation", "regression"], riskArea: "Broken navigation" }));
  }

  if (evidence.summary.formsFound > 0) {
    tests.push(manualTest({ id: `TC-EVIDENCE-${String(tests.length + 1).padStart(3, "0")}`, title: "Observed forms are visible and ready for safe validation review", feature: "Observed forms", objective: "Confirm visible forms are available before adding submission automation.", priority: "medium", severity: "major", automationSuitability: "needs-clarification", tags: ["forms", "validation", "needs-review"], riskArea: "Form validation" }));
  }

  return tests;
}

function manualTest(overrides: Partial<ManualFrameworkTest>): ManualFrameworkTest {
  return {
    id: overrides.id ?? "TC-EVIDENCE-001",
    feature: overrides.feature ?? "Observed site evidence",
    title: overrides.title ?? "Evidence-backed manual test",
    objective: overrides.objective ?? "Verify observed public website behavior.",
    preconditions: overrides.preconditions ?? ["Observed public site is available"],
    testData: overrides.testData ?? ["No private credentials required"],
    steps: overrides.steps ?? [
      { action: "Open the observed page", expectedResult: "The page responds successfully" },
      { action: "Wait for visible content", expectedResult: "The page body renders meaningful public content" },
      { action: "Check observed evidence", expectedResult: "Observed title, heading, text, button, or link is still present" }
    ],
    finalExpectedResult: overrides.finalExpectedResult ?? "The observed public behavior is preserved.",
    priority: overrides.priority ?? "medium",
    severity: overrides.severity ?? "major",
    testType: overrides.testType ?? "Smoke, regression",
    testLevel: overrides.testLevel ?? "End-to-end",
    classification: overrides.classification ?? "positive",
    automationSuitability: overrides.automationSuitability ?? "needs-clarification",
    automationNotes: overrides.automationNotes ?? "Automate only when backed by observed evidence.",
    tags: overrides.tags ?? ["regression"],
    riskArea: overrides.riskArea ?? "Regression risk",
    testerNotes: overrides.testerNotes ?? "Review generated assumptions before expanding coverage."
  };
}

function createSuitability(tests: ManualFrameworkTest[], evidence: SiteEvidence): SuitabilityResult[] {
  return tests.map((test) => {
    const canAutomate = evidence.pages.length > 0 && test.automationSuitability === "automate";
    return {
      testCaseId: test.id,
      recommendation: canAutomate ? "automate" : test.automationSuitability === "manual-only" ? "manual-only" : "needs-clarification",
      score: canAutomate ? (test.priority === "critical" ? 94 : 88) : 45,
      reasons: canAutomate ? ["Grounded in observed site evidence", "Uses public page/content/link assertions", "Does not require private credentials"] : ["Requires more evidence, safe test data, credentials, or business-rule confirmation"],
      blockers: canAutomate ? [] : [evidence.error ?? "Not enough safe evidence for runnable automation"],
      selectorAssumptions: canAutomate ? ["Generated assertions use observed public evidence"] : [],
      testDataNeeds: test.testData,
      maintenanceRisk: canAutomate ? "low" : "medium",
      recommendedAutomationLayer: canAutomate ? "ui" : "none"
    };
  });
}

function createFallbackBlueprints(evidence: SiteEvidence, tests: ManualFrameworkTest[], suitability: SuitabilityResult[]): AutomationBlueprint[] {
  const automatableIds = new Set(suitability.filter((item) => item.recommendation === "automate").map((item) => item.testCaseId));
  return tests.filter((test) => automatableIds.has(test.id)).slice(0, Math.max(1, Math.min(8, evidence.pages.length))).flatMap((test, index) => {
    const page = evidence.pages[index % evidence.pages.length];
    if (!page) return [];

    const assertions: AutomationAssertion[] = [{ kind: "page-load" }];
    if (page.headings[0]?.text) assertions.push({ kind: "heading-visible", value: page.headings[0].text });
    else if (page.title) assertions.push({ kind: "title-contains", value: page.title });
    else if (page.textSnippets[0]) assertions.push({ kind: "body-contains", value: page.textSnippets[0] });

    const internalLink = page.links.find((link) => link.internal);
    if (internalLink?.text) assertions.push({ kind: "link-visible", value: internalLink.text });
    if (internalLink?.href) assertions.push({ kind: "internal-link-ok", href: internalLink.href });

    return [{ id: `AUTO-EVIDENCE-${String(index + 1).padStart(3, "0")}`, testCaseId: test.id, title: test.title, pageUrl: page.url, tags: normalizeTags(test.tags), assertions: assertions.slice(0, 5) }];
  });
}

function normalizeManualTest(input: unknown): ManualFrameworkTest | null {
  const item = input as Record<string, unknown>;
  const id = clean(String(item.id ?? ""));
  const title = clean(String(item.title ?? ""));
  if (!id.startsWith("TC-") || !title) return null;

  const steps = Array.isArray(item.steps)
    ? item.steps.map((step) => {
        const value = step as Record<string, unknown>;
        return { action: clean(String(value.action ?? "")), expectedResult: clean(String(value.expectedResult ?? "")) };
      }).filter((step) => step.action && step.expectedResult)
    : [];

  return manualTest({
    id,
    title,
    feature: clean(String(item.feature ?? "Observed site evidence")),
    objective: clean(String(item.objective ?? "Verify observed website behavior.")),
    preconditions: stringArray(item.preconditions, ["Observed public site is available"]),
    testData: stringArray(item.testData, ["No private credentials required"]),
    steps: steps.length ? steps : undefined,
    finalExpectedResult: clean(String(item.finalExpectedResult ?? "Expected public behavior is preserved.")),
    priority: priorityValue(item.priority),
    severity: severityValue(item.severity),
    testType: clean(String(item.testType ?? "Smoke, regression")),
    testLevel: clean(String(item.testLevel ?? "End-to-end")),
    classification: classificationValue(item.classification),
    automationSuitability: automationSuitabilityValue(item.automationSuitability),
    automationNotes: clean(String(item.automationNotes ?? "Requires evidence review.")),
    tags: stringArray(item.tags, ["regression"]),
    riskArea: clean(String(item.riskArea ?? "Regression risk")),
    testerNotes: clean(String(item.testerNotes ?? "Review before execution."))
  });
}

function normalizeBlueprint(input: unknown, evidence: SiteEvidence, tests: ManualFrameworkTest[]): AutomationBlueprint | null {
  const item = input as Record<string, unknown>;
  const testCaseId = clean(String(item.testCaseId ?? ""));
  const pageUrl = clean(String(item.pageUrl ?? ""));
  const page = evidence.pages.find((candidate) => candidate.url === pageUrl);
  const linkedTest = tests.find((test) => test.id === testCaseId);
  const rawAssertions = Array.isArray(item.assertions) ? item.assertions : [];
  const assertions = rawAssertions.map((assertion) => normalizeAssertion(assertion, page, evidence.origin)).filter((assertion): assertion is AutomationAssertion => Boolean(assertion));
  if (!page || !linkedTest || !assertions.some((assertion) => assertion.kind !== "page-load")) return null;

  const pageLoadAssertion: AutomationAssertion = { kind: "page-load" };
  return { id: clean(String(item.id ?? "")) || `AUTO-EVIDENCE-${testCaseId}`, testCaseId, title: clean(String(item.title ?? linkedTest.title)), pageUrl, tags: normalizeTags(stringArray(item.tags, linkedTest.tags)), assertions: [pageLoadAssertion, ...assertions.filter((assertion) => assertion.kind !== "page-load")].slice(0, 5) };
}

function normalizeAssertion(input: unknown, page: SitePageEvidence | undefined, origin: string): AutomationAssertion | null {
  const item = input as Record<string, unknown>;
  const kind = clean(String(item.kind ?? "")) as AutomationAssertion["kind"];
  const value = clean(String(item.value ?? ""));
  const href = clean(String(item.href ?? ""));
  if (!page) return null;
  if (kind === "page-load") return { kind };
  if (kind === "title-contains" && value && page.title.toLowerCase().includes(value.toLowerCase())) return { kind, value };
  if (kind === "body-contains" && value && page.textSnippets.some((text) => text.toLowerCase().includes(value.toLowerCase()))) return { kind, value };
  if (kind === "heading-visible" && value && page.headings.some((heading) => heading.text.toLowerCase().includes(value.toLowerCase()))) return { kind, value };
  if (kind === "button-visible" && value && page.buttons.some((button) => button.text.toLowerCase().includes(value.toLowerCase()))) return { kind, value };
  if (kind === "link-visible" && value && page.links.some((link) => link.text.toLowerCase().includes(value.toLowerCase()))) return { kind, value };
  if (kind === "internal-link-ok" && href && safeSameOrigin(href, origin) && page.links.some((link) => link.href === href && link.internal)) return { kind, href };
  return null;
}

function generatedSiteEvidenceSpec(project: FrameworkRequest, evidence: SiteEvidence, blueprints: AutomationBlueprint[]): string {
  if (!evidence.pages.length || !blueprints.length) {
    return `import { test, expect } from "@playwright/test";\n\ntest.describe("${escapeForTemplate(project.applicationName)} evidence generation", () => {\n  test("site analysis collected public evidence", async () => {\n    expect(${evidence.pages.length}).toBeGreaterThan(0);\n  });\n});\n`;
  }

  const tests = blueprints.map((blueprint) => {
    const pagePath = toRelativePath(blueprint.pageUrl, evidence.origin);
    const tagSuffix = blueprint.tags.length ? ` ${blueprint.tags.map((tag) => `@${tag}`).join(" ")}` : "";
    const assertionLines = blueprint.assertions.map(assertionToCode).filter(Boolean).map((line) => `    ${line}`).join("\n");
    return `  test(${JSON.stringify(`${blueprint.testCaseId}: ${blueprint.title}${tagSuffix}`)}, async ({ page, request }) => {\n    const response = await page.goto(${JSON.stringify(pagePath)}, { waitUntil: "domcontentloaded" });\n    expect(response?.status() ?? 0).toBeLessThan(400);\n    await expect(page.locator("body")).toBeVisible();\n${assertionLines}\n  });`;
  }).join("\n\n");

  return `import { test, expect } from "@playwright/test";\n\ntest.describe(${JSON.stringify(`${project.applicationName} AI evidence-backed tests`)}, () => {\n${tests}\n});\n`;
}

function assertionToCode(assertion: AutomationAssertion): string {
  if (assertion.kind === "page-load") return "";
  if (assertion.kind === "title-contains" && assertion.value) return `await expect(page).toHaveTitle(new RegExp(${JSON.stringify(escapeRegex(stableText(assertion.value)))}, "i"));`;
  if (assertion.kind === "body-contains" && assertion.value) return `await expect(page.locator("body")).toContainText(${JSON.stringify(stableText(assertion.value))});`;
  if (assertion.kind === "heading-visible" && assertion.value) return `await expect(page.getByRole("heading", { name: new RegExp(${JSON.stringify(escapeRegex(stableText(assertion.value)))}, "i") }).first()).toBeVisible();`;
  if (assertion.kind === "button-visible" && assertion.value) return `await expect(page.getByRole("button", { name: new RegExp(${JSON.stringify(escapeRegex(stableText(assertion.value)))}, "i") }).first()).toBeVisible();`;
  if (assertion.kind === "link-visible" && assertion.value) return `await expect(page.getByRole("link", { name: new RegExp(${JSON.stringify(escapeRegex(stableText(assertion.value)))}, "i") }).first()).toBeVisible();`;
  if (assertion.kind === "internal-link-ok" && assertion.href) return `expect((await request.get(${JSON.stringify(assertion.href)})).status()).toBeLessThan(400);`;
  return "";
}

function validateFrameworkFiles(files: GeneratedFrameworkFile[], evidence: SiteEvidence): FrameworkValidation {
  const blockingErrors: string[] = [];
  const warnings: string[] = [];
  const paths = new Set<string>();
  const required = ["package.json", "tsconfig.json", "playwright.config.ts", ".env.example", ".gitignore", "README.md", "statqa-framework-manifest.json", "data/siteEvidence.json", "data/manualTestCases.json", "data/automationBlueprints.json", "docs/site-analysis.md", "docs/manual-test-cases.md", "docs/automation-decisions.md", "tests/generated/site-evidence.spec.ts"];

  for (const file of files) {
    if (!file.path || file.path.includes("..") || file.path.startsWith("/") || /^[a-z]:/i.test(file.path)) blockingErrors.push(`Unsafe file path: ${file.path}`);
    if (paths.has(file.path)) blockingErrors.push(`Duplicate file path: ${file.path}`);
    paths.add(file.path);
    if (file.content.includes("waitForTimeout")) blockingErrors.push(`Generated code must not use arbitrary waits: ${file.path}`);
    if (file.path.endsWith(".spec.ts") && !file.content.includes("expect(")) blockingErrors.push(`Spec file has no visible assertion: ${file.path}`);
    if (file.path.endsWith(".spec.ts") && /TODO|replace-with|example\.test/i.test(file.content)) blockingErrors.push(`Runnable spec contains placeholder/demo content: ${file.path}`);
  }

  for (const path of required) {
    if (!paths.has(path)) blockingErrors.push(`Missing required file: ${path}`);
  }

  if (!evidence.pages.length) blockingErrors.push("Cannot export runnable framework because no public site evidence was collected.");
  if (evidence.status === "partial") warnings.push(evidence.error ?? "Site analysis completed with partial evidence.");
  return { exportReady: blockingErrors.length === 0, blockingErrors, warnings };
}

function createTestStrategy(project: FrameworkRequest, evidence: SiteEvidence): FrameworkBuilderResult["testStrategy"] {
  return {
    objectives: [`Generate Playwright tests for ${project.applicationName} from observed site evidence.`, "Avoid fake routes, invented selectors, and private flows.", "Keep manual and automated coverage traceable."],
    riskPriorities: [`Pages analyzed: ${evidence.summary.pagesAnalyzed}`, `Internal links found: ${evidence.summary.internalLinksFound}`, `Forms found: ${evidence.summary.formsFound}`, ...project.riskAreas],
    automationFocus: ["Public page availability", "Observed headings/text/buttons", "Same-origin link reachability"],
    manualFocus: ["Login/private flows", "Form submission", "Payments/admin/destructive actions", "Subjective visual review"],
    assumptions: ["The public site remains available when tests run.", "If the site changes, regenerate the framework."]
  };
}

function packageJson(project: FrameworkRequest): string {
  return JSON.stringify({ name: `${slug(project.applicationName)}-playwright-framework`, version: "1.0.0", private: true, scripts: { test: "playwright test", "test:generated": "playwright test tests/generated", "test:headed": "playwright test --headed", "test:ui": "playwright test --ui", report: "playwright show-report reports/html-report" }, devDependencies: { "@playwright/test": "^1.52.0", "@types/node": "^22.0.0", dotenv: "^16.4.5", typescript: "^5.8.3" } }, null, 2);
}

function tsconfigJson(): string {
  return JSON.stringify({ compilerOptions: { target: "ES2022", module: "CommonJS", moduleResolution: "Node", strict: true, esModuleInterop: true, skipLibCheck: true, types: ["node", "@playwright/test"], noEmit: true }, include: ["tests", "pages", "utils", "config", "data"] }, null, 2);
}

function playwrightConfig(project: FrameworkRequest): string {
  const projects = project.supportedBrowsers.map((browser) => `    { name: ${JSON.stringify(browser)} }`).join(",\n");
  return `import { defineConfig } from "@playwright/test";\nimport dotenv from "dotenv";\n\ndotenv.config();\n\nexport default defineConfig({\n  testDir: "./tests",\n  timeout: 30_000,\n  expect: { timeout: 10_000 },\n  fullyParallel: true,\n  forbidOnly: !!process.env.CI,\n  retries: process.env.CI ? 2 : 0,\n  reporter: [["list"], ["html", { outputFolder: "reports/html-report", open: "never" }]],\n  use: { baseURL: process.env.BASE_URL, trace: "on-first-retry", screenshot: "only-on-failure", video: "retain-on-failure" },\n  projects: [\n${projects}\n  ]\n});\n`;
}

function gitignore(): string {
  return `node_modules/\n.env\ntest-results/\nplaywright-report/\nreports/\nblob-report/\n*.log\n`;
}

function readme(project: FrameworkRequest, evidence: SiteEvidence, blueprints: AutomationBlueprint[]): string {
  return `# ${project.applicationName} Playwright Framework\n\nGenerated by StatQA from real site evidence.\n\n- Pages analyzed: ${evidence.summary.pagesAnalyzed}\n- Manual tests: generated in docs/manual-test-cases.md\n- Runnable specs: ${blueprints.length ? "tests/generated/site-evidence.spec.ts" : "blocked until public evidence is available"}\n\n## Install\n\n\`\`\`bash\nnpm install\nnpx playwright install\n\`\`\`\n\n## Run\n\n\`\`\`bash\ncp .env.example .env\nnpm test\nnpm run report\n\`\`\`\n\nGenerated tests use observed public evidence only. Private flows and destructive actions must be configured manually before automation.\n`;
}

function createManifest(project: FrameworkRequest, evidence: SiteEvidence, tests: ManualFrameworkTest[], blueprints: AutomationBlueprint[]) {
  return { projectName: project.applicationName, baseUrl: project.applicationUrl, generatedAt: new Date().toISOString(), generationMode: "ai-site-evidence", pagesAnalyzed: evidence.summary.pagesAnalyzed, manualTests: tests.length, runnableSpecs: blueprints.length ? 1 : 0, evidenceBackedAssertions: blueprints.reduce((sum, item) => sum + item.assertions.length, 0) };
}

function siteAnalysisDoc(evidence: SiteEvidence): string {
  return ["# Site Analysis Evidence", "", `Target: ${evidence.targetUrl}`, `Status: ${evidence.status}`, evidence.error ? `Error: ${evidence.error}` : "", "", "## Pages", ...evidence.pages.flatMap((page) => ["", `### ${page.path}`, `URL: ${page.url}`, `HTTP status: ${page.status ?? "unknown"}`, `Title: ${page.title || "No title observed"}`, `Headings: ${page.headings.map((heading) => heading.text).join(", ") || "none"}`, `Buttons: ${page.buttons.map((button) => button.text).join(", ") || "none"}`])].filter(Boolean).join("\n");
}

function manualTestsDoc(tests: ManualFrameworkTest[]): string {
  return ["# Manual Test Cases", "", ...tests.flatMap((test) => [`## ${test.id}: ${test.title}`, "", `Feature: ${test.feature}`, `Priority: ${test.priority}`, `Severity: ${test.severity}`, `Automation suitability: ${test.automationSuitability}`, "", test.objective, "", "### Steps", ...test.steps.map((step, index) => `${index + 1}. ${step.action}\n   Expected: ${step.expectedResult}`), ""])].join("\n");
}

function automationDoc(tests: ManualFrameworkTest[], suitability: SuitabilityResult[]): string {
  return ["# Automation Decisions", "", "| Test | Recommendation | Score | Reasons | Blockers |", "| --- | --- | ---: | --- | --- |", ...tests.map((test) => {
    const decision = suitability.find((item) => item.testCaseId === test.id);
    return `| ${test.id} ${escapeMarkdownTable(test.title)} | ${decision?.recommendation ?? "manual-only"} | ${decision?.score ?? 0} | ${escapeMarkdownTable(decision?.reasons.join(", ") ?? "")} | ${escapeMarkdownTable(decision?.blockers.join(", ") ?? "")} |`;
  })].join("\n");
}

function strategyDoc(project: FrameworkRequest, evidence: SiteEvidence): string {
  return `# Test Strategy\n\nThis framework was generated from observed public evidence for ${project.applicationName}.\n\nPages analyzed: ${evidence.summary.pagesAnalyzed}\nForms found: ${evidence.summary.formsFound}\nInternal links found: ${evidence.summary.internalLinksFound}\n`;
}

function qualityChecklist(): string {
  return `# Quality Checklist\n\n- [ ] Run npm install.\n- [ ] Run npx playwright install.\n- [ ] Copy .env.example to .env.\n- [ ] Run npm test.\n- [ ] Review data/siteEvidence.json.\n- [ ] Add private/authenticated tests only after safe credentials and cleanup rules exist.\n`;
}

function testMetadata(project: FrameworkRequest, evidence: SiteEvidence): string {
  return `export const testMetadata = { applicationName: ${JSON.stringify(project.applicationName)}, baseUrl: process.env.BASE_URL, generatedBy: "StatQA AI evidence framework builder", analyzedAt: ${JSON.stringify(evidence.analyzedAt)}, pagesAnalyzed: ${evidence.summary.pagesAnalyzed}, riskAreas: ${JSON.stringify(project.riskAreas, null, 2)} } as const;\n`;
}

function envHelper(): string {
  return `export function getRequiredEnv(name: string): string {\n  const value = process.env[name];\n  if (!value) throw new Error(\`Missing required environment variable: \${name}\`);\n  return value;\n}\n`;
}

function publicPageObject(): string {
  return `import { expect, type Page } from "@playwright/test";\n\nexport class PublicPage {\n  constructor(private readonly page: Page) {}\n\n  async goto(path: string): Promise<void> {\n    const response = await this.page.goto(path, { waitUntil: "domcontentloaded" });\n    expect(response?.status() ?? 0).toBeLessThan(400);\n    await expect(this.page.locator("body")).toBeVisible();\n  }\n}\n`;
}

function githubWorkflow(): string {
  return `name: Playwright Evidence Tests\n\non:\n  push:\n    branches: [main]\n  pull_request:\n    branches: [main]\n\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n          cache: npm\n      - run: npm ci\n      - run: npx playwright install --with-deps\n      - run: npm test\n        env:\n          BASE_URL: \${{ secrets.BASE_URL }}\n`;
}

function interviewScript(project: FrameworkRequest): string {
  return `# Interview Demo Script\n\n1. Explain that ${project.applicationName} was analyzed with Playwright before generation.\n2. Show data/siteEvidence.json.\n3. Show docs/manual-test-cases.md.\n4. Show docs/automation-decisions.md.\n5. Run npm test and open the HTML report.\n`;
}

function calculateQuality(evidence: SiteEvidence, blueprints: AutomationBlueprint[], validation: FrameworkValidation): FrameworkBuilderResult["quality"] {
  const evidenceBackedAssertions = blueprints.reduce((sum, item) => sum + item.assertions.length, 0);
  return { readinessScore: Math.min(100, (evidence.pages.length ? 50 : 0) + Math.min(20, evidence.pages.length * 4) + Math.min(20, evidenceBackedAssertions * 2) + (validation.exportReady ? 10 : 0)), runnableSpecCount: blueprints.length ? 1 : 0, evidenceBackedAssertions, aiBlueprintsUsed: blueprints.length };
}

function compactEvidence(evidence: SiteEvidence) {
  return { targetUrl: evidence.targetUrl, origin: evidence.origin, status: evidence.status, summary: evidence.summary, pages: evidence.pages.map((page) => ({ url: page.url, path: page.path, status: page.status, title: page.title, headings: page.headings.map((heading) => heading.text), buttons: page.buttons.map((button) => button.text), internalLinks: page.links.filter((link) => link.internal), inputs: page.inputs, forms: page.forms, textSnippets: page.textSnippets })) };
}

function frameworkFile(path: string, purpose: string, language: FrameworkLanguage, content: string): GeneratedFrameworkFile {
  return { path, purpose, language, content, required: true };
}

function clean(value?: string | null): string {
  return value?.trim() ?? "";
}

function optional(value: string | null): string | undefined {
  const cleaned = clean(value);
  return cleaned || undefined;
}

function normalizeList(value: string[] | undefined, fallback: string[]): string[] {
  const cleaned = (value ?? []).map((item) => item.trim()).filter(Boolean);
  return cleaned.length ? cleaned : fallback;
}

function stringArray(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : fallback;
}

function priorityValue(value: unknown): ManualFrameworkTest["priority"] {
  return value === "low" || value === "medium" || value === "high" || value === "critical" ? value : "medium";
}

function severityValue(value: unknown): ManualFrameworkTest["severity"] {
  return value === "minor" || value === "major" || value === "critical" || value === "blocker" ? value : "major";
}

function classificationValue(value: unknown): ManualFrameworkTest["classification"] {
  return value === "positive" || value === "negative" || value === "boundary" ? value : "positive";
}

function automationSuitabilityValue(value: unknown): ManualFrameworkTest["automationSuitability"] {
  return value === "automate" || value === "manual-only" || value === "needs-clarification" ? value : "needs-clarification";
}

function normalizeTags(tags: string[]): string[] {
  return Array.from(new Set(tags.map((tag) => tag.toLowerCase().replace(/^@/, "").replace(/[^a-z0-9-]+/g, "-")).filter(Boolean))).slice(0, 5);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.replace(/\s+/g, " ").trim()).filter(Boolean)));
}

function normalizeHref(value: string | null, baseUrl: string): string | null {
  if (!value) return null;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function normalizeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function safeSameOrigin(value: string, origin: string): boolean {
  try {
    return new URL(value).origin === origin;
  } catch {
    return false;
  }
}

function toRelativePath(value: string, origin: string): string {
  try {
    const url = new URL(value);
    return url.origin === origin ? `${url.pathname}${url.search || ""}` || "/" : value;
  } catch {
    return "/";
  }
}

function hostnameLabel(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "Analyzed application";
  }
}

function stableText(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 120);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeMarkdownTable(value: string): string {
  return value.replace(/\|/g, "/").replace(/\n/g, " ");
}

function escapeForTemplate(value: string): string {
  return value.replace(/`/g, "'").replace(/\$/g, "");
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "statqa-framework";
}
