import { chromium, type Page } from "playwright";
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

interface ElementSummary {
  text: string;
  selectorHint?: string;
}

interface InputSummary {
  type: string;
  name?: string;
  label?: string;
  placeholder?: string;
}

interface FormSummary {
  name: string;
  inputs: InputSummary[];
  submitLabels: string[];
}

interface LinkSummary {
  text: string;
  href: string;
  internal: boolean;
}

interface SitePageEvidence {
  url: string;
  path: string;
  title: string;
  status: number | null;
  headings: ElementSummary[];
  buttons: ElementSummary[];
  links: LinkSummary[];
  inputs: InputSummary[];
  forms: FormSummary[];
  textSnippets: string[];
}

interface SiteEvidence {
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
const DEFAULT_RULES = ["Public pages should load without browser errors", "Visible navigation should remain reachable"];
const DEFAULT_RISKS = ["Broken navigation", "Missing primary content", "Form discoverability", "Regression risk"];
const DEFAULT_BROWSERS = ["chromium", "firefox", "webkit"];
const MAX_ANALYZED_PAGES = 5;

export async function buildFrameworkPackage(input: Partial<FrameworkRequest>): Promise<FrameworkBuilderResult> {
  const project = normalizeFrameworkRequest(input);
  const siteEvidence = await collectSiteEvidence(project.applicationUrl);
  const manualTests = await generateManualTestsWithAI(project, siteEvidence);
  const suitability = createSuitability(manualTests, siteEvidence);
  const blueprints = await generateAutomationBlueprintsWithAI(project, siteEvidence, manualTests, suitability);
  const files = createFrameworkFiles(project, siteEvidence, manualTests, suitability, blueprints);
  const validation = validateFrameworkFiles(files, siteEvidence);
  const quality = calculateQuality(siteEvidence, blueprints, validation);

  return {
    project,
    testStrategy: createTestStrategy(project, siteEvidence),
    manualTests,
    suitability,
    files,
    validation,
    generatedAt: new Date().toISOString(),
    siteEvidence,
    quality
  };
}

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
      "Public website QA coverage generated from real site evidence, observed pages, visible content, links, forms, and safe browser checks.",
    mainRoles: normalizeList(input.mainRoles, DEFAULT_ROLES),
    criticalFlows: normalizeList(input.criticalFlows, DEFAULT_FLOWS),
    businessRules: normalizeList(input.businessRules, DEFAULT_RULES),
    riskAreas: normalizeList(input.riskAreas, DEFAULT_RISKS),
    supportedBrowsers: normalizeList(input.supportedBrowsers, DEFAULT_BROWSERS),
    includeCi: input.includeCi ?? true,
    portfolioMode: input.portfolioMode ?? true
  };
}

async function collectSiteEvidence(targetUrl: string): Promise<SiteEvidence> {
  const origin = new URL(targetUrl).origin;
  const discoveredInternalLinks = new Set<string>([targetUrl]);
  const pages: SitePageEvidence[] = [];
  const queue = [targetUrl];
  const visited = new Set<string>();
  let browser;
  let lastError: string | undefined;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1366, height: 900 } });

    while (queue.length && pages.length < MAX_ANALYZED_PAGES) {
      const nextUrl = queue.shift();
      if (!nextUrl || visited.has(nextUrl)) {
        continue;
      }
      visited.add(nextUrl);

      const page = await context.newPage();
      try {
        const evidence = await inspectPage(page, nextUrl, origin);
        pages.push(evidence);

        for (const link of evidence.links) {
          if (link.internal) {
            const normalized = normalizeUrl(link.href);
            if (normalized && !visited.has(normalized)) {
              discoveredInternalLinks.add(normalized);
              if (queue.length + pages.length < MAX_ANALYZED_PAGES) {
                queue.push(normalized);
              }
            }
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

  const status: SiteEvidence["status"] = pages.length ? (lastError ? "partial" : "ok") : "failed";

  return {
    targetUrl,
    origin,
    analyzedAt: new Date().toISOString(),
    status,
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

  const snapshot = await page.evaluate(() => {
    const cleanText = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();
    const isVisible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const textOf = (element: Element) =>
      cleanText(element.textContent) ||
      cleanText(element.getAttribute("aria-label")) ||
      cleanText(element.getAttribute("title")) ||
      cleanText((element as HTMLInputElement).value) ||
      cleanText(element.getAttribute("placeholder"));
    const unique = <T extends { text?: string; href?: string }>(items: T[]) => {
      const seen = new Set<string>();
      return items.filter((item) => {
        const key = `${item.text ?? ""}|${item.href ?? ""}`.toLowerCase();
        if (!key.trim() || seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
    };
    const elementSummaries = (selector: string) =>
      unique(
        Array.from(document.querySelectorAll(selector))
          .filter(isVisible)
          .map((element) => ({ text: textOf(element).slice(0, 120) }))
          .filter((item) => item.text.length >= 2)
      ).slice(0, 12);

    const links = unique(
      Array.from(document.querySelectorAll("a[href]"))
        .filter(isVisible)
        .map((element) => ({
          text: textOf(element).slice(0, 120),
          href: (element as HTMLAnchorElement).href
        }))
        .filter((item) => item.href && !item.href.startsWith("mailto:") && !item.href.startsWith("tel:"))
    ).slice(0, 30);

    const inputs = Array.from(document.querySelectorAll("input, textarea, select"))
      .filter(isVisible)
      .map((element) => {
        const id = element.getAttribute("id");
        const label = id ? cleanText(document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent) : "";
        return {
          type: cleanText(element.getAttribute("type")) || element.tagName.toLowerCase(),
          name: cleanText(element.getAttribute("name")) || undefined,
          label: label || cleanText(element.getAttribute("aria-label")) || undefined,
          placeholder: cleanText(element.getAttribute("placeholder")) || undefined
        };
      })
      .slice(0, 20);

    const forms = Array.from(document.querySelectorAll("form"))
      .filter(isVisible)
      .map((form, index) => ({
        name: cleanText(form.getAttribute("name")) || `Form ${index + 1}`,
        inputs: Array.from(form.querySelectorAll("input, textarea, select"))
          .filter(isVisible)
          .map((element) => ({
            type: cleanText(element.getAttribute("type")) || element.tagName.toLowerCase(),
            name: cleanText(element.getAttribute("name")) || undefined,
            placeholder: cleanText(element.getAttribute("placeholder")) || undefined
          }))
          .slice(0, 12),
        submitLabels: Array.from(form.querySelectorAll("button, input[type='submit']"))
          .filter(isVisible)
          .map(textOf)
          .filter(Boolean)
          .slice(0, 5)
      }))
      .slice(0, 8);

    const textSnippets = unique(
      cleanText(document.body?.innerText)
        .split(/(?<=[.!?])\s+|\n+/)
        .map((text) => ({ text: text.slice(0, 180) }))
        .filter((item) => item.text.length >= 20)
    ).slice(0, 12);

    return {
      title: cleanText(document.title),
      headings: elementSummaries("h1, h2, h3"),
      buttons: elementSummaries("button, [role='button'], input[type='submit'], input[type='button']"),
      links,
      inputs,
      forms,
      textSnippets
    };
  });

  const finalUrl = page.url();
  const final = new URL(finalUrl);
  const links = snapshot.links.map((link) => ({ ...link, internal: safeSameOrigin(link.href, origin) }));

  return {
    url: finalUrl,
    path: final.pathname + final.search,
    status: response?.status() ?? null,
    title: snapshot.title,
    headings: snapshot.headings,
    buttons: snapshot.buttons,
    links,
    inputs: snapshot.inputs,
    forms: snapshot.forms,
    textSnippets: snapshot.textSnippets.map((item) => item.text)
  };
}

async function generateManualTestsWithAI(project: FrameworkRequest, evidence: SiteEvidence): Promise<ManualFrameworkTest[]> {
  const fallback = createFallbackManualTests(project, evidence);
  if (!evidence.pages.length) {
    return fallback;
  }

  try {
    const result = await callGroqJson([
      {
        role: "system",
        content:
          "You are a senior QA engineer. Generate manual test cases only from observed website evidence. Do not invent routes, hidden auth flows, selectors, data, or private app behavior. Return valid JSON only."
      },
      {
        role: "user",
        content: `Create 8-12 high quality manual tests for this app.

App: ${project.applicationName}
URL: ${project.applicationUrl}
Description: ${project.productDescription}
User roles: ${project.mainRoles.join(", ")}
Critical flows requested by user: ${project.criticalFlows.join(", ")}
Business rules requested by user: ${project.businessRules.join(", ")}
Risk areas requested by user: ${project.riskAreas.join(", ")}

Observed site evidence:
${JSON.stringify(compactEvidence(evidence), null, 2)}

Rules:
- Every test must be grounded in the observed evidence.
- Public page loading, visible content, navigation reachability, forms, buttons, and safe non-destructive interactions are valid.
- If credentials, checkout, destructive actions, CAPTCHA, payment, private dashboards, or unobserved routes are needed, mark automationSuitability as needs-clarification or manual-only.
- Do not invent /login, /dashboard, create, edit, delete, admin, or checkout tests unless evidence shows them.
- Use best manual testing practices: objective, preconditions, data, numbered steps, expected results, priority, severity, risk, notes.

Return JSON array only with this shape:
[
  {
    "id": "TC-EVIDENCE-001",
    "feature": "Observed feature",
    "title": "Clear title",
    "objective": "What is verified and why",
    "preconditions": ["Observed public site is available"],
    "testData": ["Only data visible or safe to use"],
    "steps": [{ "action": "Action", "expectedResult": "Expected result" }],
    "finalExpectedResult": "Final expected result",
    "priority": "critical|high|medium|low",
    "severity": "blocker|critical|major|minor",
    "testType": "Smoke, regression, navigation, validation, accessibility, security",
    "testLevel": "End-to-end",
    "classification": "positive|negative|boundary",
    "automationSuitability": "automate|manual-only|needs-clarification",
    "automationNotes": "Evidence-based automation explanation",
    "tags": ["smoke", "regression"],
    "riskArea": "Risk area",
    "testerNotes": "Execution notes"
  }
]`
      }
    ]);

    const tests = Array.isArray(result) ? result : (result as { tests?: unknown[] }).tests ?? [];
    const normalized = tests.map(normalizeManualTest).filter((test): test is ManualFrameworkTest => Boolean(test));
    return normalized.length ? normalized.slice(0, 12) : fallback;
  } catch (error) {
    console.warn("AI manual test generation failed, using evidence fallback:", error instanceof Error ? error.message : "Unknown error");
    return fallback;
  }
}

async function generateAutomationBlueprintsWithAI(
  project: FrameworkRequest,
  evidence: SiteEvidence,
  tests: ManualFrameworkTest[],
  suitability: SuitabilityResult[]
): Promise<AutomationBlueprint[]> {
  const fallback = createFallbackBlueprints(evidence, tests, suitability);
  const automatableTests = tests.filter((test) => suitability.some((item) => item.testCaseId === test.id && item.recommendation === "automate"));

  if (!evidence.pages.length || !automatableTests.length) {
    return fallback;
  }

  try {
    const result = await callGroqJson([
      {
        role: "system",
        content:
          "You are an expert Playwright architect. Select evidence-backed automation blueprints from observed pages only. Do not write raw code. Do not invent selectors, routes, credentials, clicks, or data. Return valid JSON only."
      },
      {
        role: "user",
        content: `Create runnable Playwright automation blueprints from these manual tests and observed site evidence.

App: ${project.applicationName}
Base URL: ${project.applicationUrl}
Observed evidence:
${JSON.stringify(compactEvidence(evidence), null, 2)}

Automatable manual tests:
${JSON.stringify(automatableTests, null, 2)}

Allowed assertion kinds:
- page-load: page responds below 400 and body is visible
- title-contains: title contains exact observed title text or stable part of it
- body-contains: body contains exact observed text snippet
- heading-visible: observed heading text is visible
- button-visible: observed button text is visible
- link-visible: observed link text is visible
- internal-link-ok: observed internal link responds below 400

Rules:
- Use only pageUrl values that exist in observed evidence.
- Use only values that appear in observed evidence.
- Create meaningful tests, not empty pass-through tests.
- Do not include clicks that submit forms or mutate data.
- Do not use credentials or private routes unless they are observed.
- Prefer 1-3 strong assertions per test.

Return JSON only:
{
  "tests": [
    {
      "id": "AUTO-EVIDENCE-001",
      "testCaseId": "TC-EVIDENCE-001",
      "title": "Readable Playwright test title",
      "pageUrl": "exact observed page url",
      "tags": ["smoke", "regression"],
      "assertions": [
        { "kind": "page-load" },
        { "kind": "heading-visible", "value": "exact observed heading" },
        { "kind": "internal-link-ok", "href": "exact observed internal href" }
      ]
    }
  ]
}`
      }
    ]);

    const rawTests = Array.isArray((result as { tests?: unknown[] }).tests) ? (result as { tests: unknown[] }).tests : [];
    const normalized = rawTests
      .map((item) => normalizeBlueprint(item, evidence, automatableTests))
      .filter((item): item is AutomationBlueprint => Boolean(item));

    return normalized.length ? normalized.slice(0, 12) : fallback;
  } catch (error) {
    console.warn("AI automation blueprint generation failed, using evidence fallback:", error instanceof Error ? error.message : "Unknown error");
    return fallback;
  }
}

function createFrameworkFiles(
  project: FrameworkRequest,
  evidence: SiteEvidence,
  tests: ManualFrameworkTest[],
  suitability: SuitabilityResult[],
  blueprints: AutomationBlueprint[]
): GeneratedFrameworkFile[] {
  const generatedAt = new Date().toISOString();
  const validationPreview = { exportReady: true, blockingErrors: [], warnings: [] };
  const manifest = {
    projectName: project.applicationName,
    baseUrl: project.applicationUrl,
    generatedAt,
    generationMode: "ai-site-evidence",
    pagesAnalyzed: evidence.summary.pagesAnalyzed,
    manualTests: tests.length,
    automatedCandidates: suitability.filter((item) => item.recommendation === "automate").length,
    runnableSpecs: blueprints.length ? 1 : 0,
    evidenceBackedAssertions: blueprints.reduce((sum, item) => sum + item.assertions.length, 0),
    validation: validationPreview
  };

  const files: GeneratedFrameworkFile[] = [
    frameworkFile("package.json", "Playwright package with scripts that run the generated evidence-backed tests.", "json", packageJson(project)),
    frameworkFile("tsconfig.json", "Strict TypeScript configuration for the generated framework.", "json", tsconfigJson()),
    frameworkFile("playwright.config.ts", "Playwright configuration with reports, traces, screenshots, videos, retries, and browser projects.", "typescript", playwrightConfig(project)),
    frameworkFile(".env.example", "Required target URL for the generated suite. No secrets are generated.", "env", envExample(project)),
    frameworkFile(".gitignore", "Ignores local dependencies, generated reports, and environment files.", "text", gitignore()),
    frameworkFile("README.md", "Professional setup guide for the downloaded framework.", "markdown", readme(project, evidence, blueprints)),
    frameworkFile("statqa-framework-manifest.json", "Machine-readable export manifest.", "json", JSON.stringify(manifest, null, 2)),
    frameworkFile("data/siteEvidence.json", "Observed website evidence used by AI before creating tests.", "json", JSON.stringify(evidence, null, 2)),
    frameworkFile("data/manualTestCases.json", "All generated manual test cases used as the traceability source.", "json", JSON.stringify(tests, null, 2)),
    frameworkFile("data/automationBlueprints.json", "AI-selected automation blueprints compiled into runnable Playwright code.", "json", JSON.stringify(blueprints, null, 2)),
    frameworkFile("docs/site-analysis.md", "Human-readable summary of the real site analysis.", "markdown", siteAnalysisDoc(evidence)),
    frameworkFile("docs/manual-test-cases.md", "Manual test cases in clear human-readable format.", "markdown", manualTestsDoc(tests)),
    frameworkFile("docs/automation-decisions.md", "Automation suitability decisions and traceability.", "markdown", automationDoc(tests, suitability)),
    frameworkFile("docs/test-strategy.md", "Evidence-backed risk and testing strategy.", "markdown", strategyDoc(project, evidence)),
    frameworkFile("docs/quality-checklist.md", "Checklist for reviewing and extending the generated suite.", "markdown", qualityChecklist()),
    frameworkFile("config/testMetadata.ts", "Project-level metadata consumed by tests and reports.", "typescript", testMetadata(project, evidence)),
    frameworkFile("utils/env.ts", "Required environment variable helper.", "typescript", envHelper()),
    frameworkFile("utils/text.ts", "Text helpers for readable assertions.", "typescript", textHelper()),
    frameworkFile("pages/PublicPage.ts", "Reusable page object for public evidence-backed pages.", "typescript", publicPageObject()),
    frameworkFile("tests/generated/site-evidence.spec.ts", "Runnable AI-selected Playwright tests compiled from observed site evidence.", "typescript", generatedSiteEvidenceSpec(project, evidence, blueprints))
  ];

  if (project.includeCi) {
    files.push(frameworkFile(".github/workflows/playwright.yml", "GitHub Actions workflow for running the generated Playwright suite.", "yaml", githubWorkflow()));
  }

  if (project.portfolioMode) {
    files.push(frameworkFile("docs/interview-demo-script.md", "Portfolio walkthrough explaining evidence-backed AI test generation.", "markdown", interviewScript(project)));
  }

  return files;
}

function createFallbackManualTests(project: FrameworkRequest, evidence: SiteEvidence): ManualFrameworkTest[] {
  const firstPage = evidence.pages[0];
  const tests: ManualFrameworkTest[] = [];

  if (firstPage) {
    tests.push({
      id: "TC-EVIDENCE-001",
      feature: "Public page availability",
      title: `${project.applicationName} public entry page loads successfully`,
      objective: "Verify that the observed entry page responds successfully and renders primary public content.",
      preconditions: ["Target site is reachable", `Entry page was observed at ${firstPage.url}`],
      testData: ["No private credentials required"],
      steps: [
        { action: "Open the observed entry page", expectedResult: "The browser receives a successful response" },
        { action: "Wait for the document body to render", expectedResult: "Visible public content is displayed" },
        { action: "Check the observed page title or heading", expectedResult: "The same user-facing content is still present" }
      ],
      finalExpectedResult: "The public entry page is available and renders meaningful content.",
      priority: "critical",
      severity: "blocker",
      testType: "Smoke, regression",
      testLevel: "End-to-end",
      classification: "positive",
      automationSuitability: "automate",
      automationNotes: "This is grounded in observed public page evidence and can run without credentials.",
      tags: ["smoke", "regression", "public-page"],
      riskArea: "Public availability",
      testerNotes: "If this fails, the app may be unavailable or the landing content changed significantly."
    });
  }

  for (const page of evidence.pages.slice(1, 5)) {
    tests.push({
      id: `TC-EVIDENCE-${String(tests.length + 1).padStart(3, "0")}`,
      feature: "Internal navigation",
      title: `Observed internal page remains reachable: ${page.path}`,
      objective: "Verify that an internally discovered page continues to load and display observed content.",
      preconditions: [`Page was discovered from internal links: ${page.url}`],
      testData: ["No private credentials required"],
      steps: [
        { action: "Open the discovered internal page", expectedResult: "The page responds successfully" },
        { action: "Check body visibility", expectedResult: "The page renders visible content" },
        { action: "Check one observed heading or text snippet", expectedResult: "Expected public content is visible" }
      ],
      finalExpectedResult: "The internal page remains reachable and renders expected public content.",
      priority: "high",
      severity: "major",
      testType: "Navigation, regression",
      testLevel: "End-to-end",
      classification: "positive",
      automationSuitability: "automate",
      automationNotes: "This checks a real discovered internal page and avoids invented routes.",
      tags: ["navigation", "regression"],
      riskArea: "Broken navigation",
      testerNotes: "Content changes may require updating the expected evidence assertion."
    });
  }

  if (evidence.summary.formsFound > 0) {
    tests.push({
      id: `TC-EVIDENCE-${String(tests.length + 1).padStart(3, "0")}`,
      feature: "Observed forms",
      title: "Observed forms are visible and ready for manual validation review",
      objective: "Confirm visible forms and inputs are present before deeper validation or submission testing is added.",
      preconditions: ["At least one public form was observed"],
      testData: ["Safe synthetic data only; do not submit destructive forms without review"],
      steps: [
        { action: "Open the page containing the observed form", expectedResult: "The form is visible" },
        { action: "Review visible inputs and submit controls", expectedResult: "Required fields and submit actions are identifiable" },
        { action: "Decide whether form submission is safe", expectedResult: "Automation scope is confirmed before data submission" }
      ],
      finalExpectedResult: "The form is ready for reviewed validation automation, not blind submission.",
      priority: "medium",
      severity: "major",
      testType: "Validation, exploratory",
      testLevel: "End-to-end",
      classification: "positive",
      automationSuitability: "needs-clarification",
      automationNotes: "Form visibility is automatable, but submission needs business rules and safe test data.",
      tags: ["forms", "validation", "needs-review"],
      riskArea: "Form validation",
      testerNotes: "Add submission tests only after confirming expected validation messages and side effects."
    });
  }

  if (!tests.length) {
    tests.push({
      id: "TC-EVIDENCE-001",
      feature: "Site analysis",
      title: "Target site requires analysis before automation",
      objective: "Document that the site could not be analyzed enough to generate runnable automated tests.",
      preconditions: ["Target URL was submitted"],
      testData: ["N/A"],
      steps: [{ action: "Review site analysis error", expectedResult: "Blocking reason is visible" }],
      finalExpectedResult: "A human reviews site access before automation is generated.",
      priority: "critical",
      severity: "blocker",
      testType: "Setup review",
      testLevel: "Manual",
      classification: "negative",
      automationSuitability: "manual-only",
      automationNotes: "No runnable automation should be exported without observed site evidence.",
      tags: ["blocked", "analysis"],
      riskArea: "Environment access",
      testerNotes: evidence.error ?? "Playwright could not collect enough public evidence."
    });
  }

  return tests;
}

function createSuitability(tests: ManualFrameworkTest[], evidence: SiteEvidence): SuitabilityResult[] {
  const evidenceText = JSON.stringify(compactEvidence(evidence)).toLowerCase();

  return tests.map((test) => {
    const requestedAutomation = test.automationSuitability === "automate";
    const backedByEvidence = requestedAutomation && hasEvidenceForTest(test, evidenceText) && evidence.pages.length > 0;

    if (backedByEvidence) {
      return {
        testCaseId: test.id,
        recommendation: "automate",
        score: test.priority === "critical" ? 94 : 88,
        reasons: ["Grounded in observed site evidence", "Runs against public pages without invented credentials", "Uses stable page/content/link assertions"],
        blockers: [],
        selectorAssumptions: ["Assertions use observed titles, headings, text, links, or visible controls"],
        testDataNeeds: test.testData,
        maintenanceRisk: "low",
        recommendedAutomationLayer: "ui"
      };
    }

    return {
      testCaseId: test.id,
      recommendation: test.automationSuitability === "manual-only" ? "manual-only" : "needs-clarification",
      score: evidence.pages.length ? 58 : 20,
      reasons: evidence.pages.length ? ["Valuable test, but not safe to fully automate from public evidence alone"] : ["Site evidence collection failed"],
      blockers: evidence.pages.length
        ? ["Requires confirmed selectors, credentials, safe test data, or business-rule expectations"]
        : [evidence.error ?? "No observed pages were available"],
      selectorAssumptions: [],
      testDataNeeds: test.testData,
      maintenanceRisk: "medium",
      recommendedAutomationLayer: "none"
    };
  });
}

function createFallbackBlueprints(evidence: SiteEvidence, tests: ManualFrameworkTest[], suitability: SuitabilityResult[]): AutomationBlueprint[] {
  const automatableIds = new Set(suitability.filter((item) => item.recommendation === "automate").map((item) => item.testCaseId));
  const candidates = tests.filter((test) => automatableIds.has(test.id));

  return candidates.slice(0, Math.max(1, Math.min(8, evidence.pages.length || 1))).flatMap((test, index) => {
    const page = evidence.pages[index % Math.max(evidence.pages.length, 1)];
    if (!page) {
      return [];
    }
    const assertions: AutomationAssertion[] = [{ kind: "page-load" }];
    const heading = page.headings[0]?.text;
    const text = page.textSnippets[0];
    const title = page.title;
    const internalLink = page.links.find((link) => link.internal);

    if (heading) assertions.push({ kind: "heading-visible", value: heading });
    else if (title) assertions.push({ kind: "title-contains", value: title });
    else if (text) assertions.push({ kind: "body-contains", value: text });
    if (internalLink?.text) assertions.push({ kind: "link-visible", value: internalLink.text });
    if (internalLink?.href) assertions.push({ kind: "internal-link-ok", href: internalLink.href });

    return [
      {
        id: `AUTO-EVIDENCE-${String(index + 1).padStart(3, "0")}`,
        testCaseId: test.id,
        title: test.title,
        pageUrl: page.url,
        tags: normalizeTags(test.tags),
        assertions: assertions.slice(0, 4)
      }
    ];
  });
}

function generatedSiteEvidenceSpec(project: FrameworkRequest, evidence: SiteEvidence, blueprints: AutomationBlueprint[]): string {
  if (!evidence.pages.length || !blueprints.length) {
    return `import { test, expect } from "@playwright/test";

test.describe("Site evidence generation", () => {
  test("site analysis produced enough public evidence", async () => {
    expect(${evidence.pages.length}, "StatQA must observe at least one page before exporting runnable tests").toBeGreaterThan(0);
  });
});
`;
  }

  const testBlocks = blueprints
    .map((blueprint) => {
      const pagePath = toRelativePath(blueprint.pageUrl, evidence.origin);
      const tags = blueprint.tags.length ? ` ${blueprint.tags.map((tag) => `@${tag.replace(/^@/, "")}`).join(" ")}` : "";
      const assertionLines = blueprint.assertions.map((assertion) => assertionToCode(assertion)).filter(Boolean);
      return `  test(${JSON.stringify(`${blueprint.testCaseId}: ${blueprint.title}${tags}`)}, async ({ page, request }) => {
    const response = await page.goto(${JSON.stringify(pagePath)}, { waitUntil: "domcontentloaded" });
    expect(response?.status() ?? 0, "${escapeForDoubleQuote(blueprint.pageUrl)} should respond successfully").toBeLessThan(400);
    await expect(page.locator("body"), "Page body should be visible").toBeVisible();
${assertionLines.map((line) => `    ${line}`).join("\n")}
  });`;
    })
    .join("\n\n");

  return `import { test, expect } from "@playwright/test";

// Generated by StatQA from real site evidence collected at ${evidence.analyzedAt}.
// These tests intentionally avoid invented credentials, private routes, destructive clicks, and fake selectors.

test.describe(${JSON.stringify(`${project.applicationName} AI evidence-backed tests`)}, () => {
${testBlocks}
});
`;
}

function assertionToCode(assertion: AutomationAssertion): string {
  if (assertion.kind === "page-load") return "";
  if (assertion.kind === "title-contains" && assertion.value) {
    return `await expect(page).toHaveTitle(new RegExp(${JSON.stringify(escapeRegex(stableText(assertion.value)))}, "i"));`;
  }
  if (assertion.kind === "body-contains" && assertion.value) {
    return `await expect(page.locator("body")).toContainText(${JSON.stringify(stableText(assertion.value))});`;
  }
  if (assertion.kind === "heading-visible" && assertion.value) {
    return `await expect(page.getByRole("heading", { name: new RegExp(${JSON.stringify(escapeRegex(stableText(assertion.value)))}, "i") }).first()).toBeVisible();`;
  }
  if (assertion.kind === "button-visible" && assertion.value) {
    return `await expect(page.getByRole("button", { name: new RegExp(${JSON.stringify(escapeRegex(stableText(assertion.value)))}, "i") }).first()).toBeVisible();`;
  }
  if (assertion.kind === "link-visible" && assertion.value) {
    return `await expect(page.getByRole("link", { name: new RegExp(${JSON.stringify(escapeRegex(stableText(assertion.value)))}, "i") }).first()).toBeVisible();`;
  }
  if (assertion.kind === "internal-link-ok" && assertion.href) {
    return `expect((await request.get(${JSON.stringify(assertion.href)})).status(), ${JSON.stringify(`${assertion.href} should be reachable`)}).toBeLessThan(400);`;
  }
  return "";
}

function validateFrameworkFiles(files: GeneratedFrameworkFile[], evidence: SiteEvidence): FrameworkValidation {
  const blockingErrors: string[] = [];
  const warnings: string[] = [];
  const paths = new Set<string>();
  const required = [
    "package.json",
    "tsconfig.json",
    "playwright.config.ts",
    ".env.example",
    ".gitignore",
    "README.md",
    "statqa-framework-manifest.json",
    "data/siteEvidence.json",
    "data/manualTestCases.json",
    "data/automationBlueprints.json",
    "docs/site-analysis.md",
    "docs/manual-test-cases.md",
    "docs/automation-decisions.md",
    "tests/generated/site-evidence.spec.ts"
  ];

  for (const file of files) {
    if (!file.path || file.path.includes("..") || file.path.startsWith("/") || /^[a-z]:/i.test(file.path)) {
      blockingErrors.push(`Unsafe file path: ${file.path}`);
    }
    if (paths.has(file.path)) {
      blockingErrors.push(`Duplicate file path: ${file.path}`);
    }
    paths.add(file.path);
    if (file.content.includes("waitForTimeout")) {
      blockingErrors.push(`Generated code must not use arbitrary waits: ${file.path}`);
    }
    if (file.path.endsWith(".spec.ts") && !file.content.includes("expect(")) {
      blockingErrors.push(`Spec file has no visible assertion: ${file.path}`);
    }
    if (file.path.endsWith(".spec.ts") && /TODO|replace-with|example\.test/i.test(file.content)) {
      blockingErrors.push(`Runnable spec contains placeholder/demo content: ${file.path}`);
    }
  }

  for (const requiredPath of required) {
    if (!paths.has(requiredPath)) {
      blockingErrors.push(`Missing required file: ${requiredPath}`);
    }
  }

  if (!evidence.pages.length) {
    blockingErrors.push("Cannot export runnable framework because no public site evidence was collected.");
  }

  if (![...paths].some((path) => path.startsWith("tests/") && path.endsWith(".spec.ts"))) {
    blockingErrors.push("At least one Playwright spec file is required.");
  }

  if (evidence.status === "partial") {
    warnings.push(evidence.error ?? "Site analysis completed with partial evidence.");
  }

  return { exportReady: blockingErrors.length === 0, blockingErrors, warnings };
}

function normalizeManualTest(input: unknown): ManualFrameworkTest | null {
  const item = input as Record<string, unknown>;
  const id = clean(String(item.id ?? ""));
  const steps = Array.isArray(item.steps)
    ? item.steps.map((step) => {
        const value = step as Record<string, unknown>;
        return { action: clean(String(value.action ?? "")), expectedResult: clean(String(value.expectedResult ?? "")) };
      }).filter((step) => step.action && step.expectedResult)
    : [];

  if (!id.startsWith("TC-") || !clean(String(item.title ?? "")) || !steps.length) {
    return null;
  }

  return {
    id,
    feature: clean(String(item.feature ?? "Observed site evidence")),
    title: clean(String(item.title ?? "Evidence-backed test")),
    objective: clean(String(item.objective ?? "Verify observed website behavior.")),
    preconditions: stringArray(item.preconditions, ["Observed public site is available"]),
    testData: stringArray(item.testData, ["No private credentials required"]),
    steps,
    finalExpectedResult: clean(String(item.finalExpectedResult ?? "Expected public behavior is preserved.")),
    priority: enumValue(item.priority, ["low", "medium", "high", "critical"], "medium"),
    severity: enumValue(item.severity, ["minor", "major", "critical", "blocker"], "major"),
    testType: clean(String(item.testType ?? "Smoke, regression")),
    testLevel: clean(String(item.testLevel ?? "End-to-end")),
    classification: enumValue(item.classification, ["positive", "negative", "boundary"], "positive"),
    automationSuitability: enumValue(item.automationSuitability, ["automate", "manual-only", "needs-clarification"], "needs-clarification"),
    automationNotes: clean(String(item.automationNotes ?? "Requires evidence review.")),
    tags: stringArray(item.tags, ["regression"]),
    riskArea: clean(String(item.riskArea ?? "Regression risk")),
    testerNotes: clean(String(item.testerNotes ?? "Review before execution."))
  };
}

function normalizeBlueprint(input: unknown, evidence: SiteEvidence, tests: ManualFrameworkTest[]): AutomationBlueprint | null {
  const item = input as Record<string, unknown>;
  const id = clean(String(item.id ?? "")) || `AUTO-EVIDENCE-${Math.random().toString(36).slice(2, 8)}`;
  const testCaseId = clean(String(item.testCaseId ?? ""));
  const pageUrl = clean(String(item.pageUrl ?? ""));
  const page = evidence.pages.find((candidate) => candidate.url === pageUrl);
  const linkedTest = tests.find((test) => test.id === testCaseId);
  const rawAssertions = Array.isArray(item.assertions) ? item.assertions : [];
  const assertions = rawAssertions
    .map((assertion) => normalizeAssertion(assertion, page, evidence.origin))
    .filter((assertion): assertion is AutomationAssertion => Boolean(assertion));

  if (!page || !linkedTest || !assertions.some((assertion) => assertion.kind !== "page-load")) {
    return null;
  }

  return {
    id,
    testCaseId,
    title: clean(String(item.title ?? linkedTest.title)),
    pageUrl,
    tags: normalizeTags(stringArray(item.tags, linkedTest.tags)),
    assertions: [{ kind: "page-load" }, ...assertions.filter((assertion) => assertion.kind !== "page-load")].slice(0, 5)
  };
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
  if (kind === "internal-link-ok" && href && page.links.some((link) => link.href === href && link.internal) && safeSameOrigin(href, origin)) return { kind, href };
  return null;
}

function hasEvidenceForTest(test: ManualFrameworkTest, evidenceText: string): boolean {
  const terms = [test.feature, test.title, test.riskArea, ...test.tags]
    .flatMap((value) => value.toLowerCase().split(/[^a-z0-9]+/))
    .filter((term) => term.length >= 4 && !["test", "case", "page", "site", "user", "with", "from"].includes(term));
  return !terms.length || terms.some((term) => evidenceText.includes(term)) || test.tags.some((tag) => ["smoke", "regression", "navigation"].includes(tag.toLowerCase()));
}

function createTestStrategy(project: FrameworkRequest, evidence: SiteEvidence): FrameworkBuilderResult["testStrategy"] {
  return {
    objectives: [
      `Generate Playwright tests for ${project.applicationName} from real observed site evidence.`,
      "Avoid fake routes, invented selectors, and private flows that were not visible during analysis.",
      "Keep manual coverage and runnable automation traceable to the same generated cases."
    ],
    riskPriorities: [
      `Public availability: ${evidence.summary.pagesAnalyzed} page(s) analyzed.`,
      `Navigation stability: ${evidence.summary.internalLinksFound} internal link(s) discovered.`,
      `Form risk: ${evidence.summary.formsFound} form(s) found and kept safe until side effects are reviewed.`,
      ...project.riskAreas.map((risk) => `${risk}: review against observed evidence before automating risky behavior.`)
    ],
    automationFocus: [
      "Runnable public page checks based on observed status, body, title, heading, link, and button evidence.",
      "Internal link reachability checks for discovered same-origin links.",
      "Generated code compiled from AI-selected blueprints rather than raw untrusted AI code."
    ],
    manualFocus: [
      "Credentials, private dashboards, checkout, payment, create/edit/delete, and any side-effect flow.",
      "Form submission behavior until expected validation messages and safe test data are confirmed.",
      "Visual quality, copy review, and subjective acceptance criteria."
    ],
    assumptions: [
      "The target public site remains available when the downloaded framework is run.",
      "Generated runnable tests intentionally use only observed public evidence.",
      "If the site changes, update the evidence JSON or regenerate the framework."
    ]
  };
}

function packageJson(project: FrameworkRequest): string {
  return JSON.stringify(
    {
      name: `${slug(project.applicationName)}-playwright-framework`,
      version: "1.0.0",
      private: true,
      scripts: {
        test: "playwright test",
        "test:generated": "playwright test tests/generated",
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
      include: ["tests", "pages", "utils", "config", "data"]
    },
    null,
    2
  );
}

function playwrightConfig(project: FrameworkRequest): string {
  const projects = project.supportedBrowsers.map((browser) => `    { name: ${JSON.stringify(browser)} }`).join(",\n");
  return `import { defineConfig } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: { timeout: 10_000 },
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
${projects}
  ]
});
`;
}

function envExample(project: FrameworkRequest): string {
  return `BASE_URL=${new URL(project.applicationUrl).origin}
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

function readme(project: FrameworkRequest, evidence: SiteEvidence, blueprints: AutomationBlueprint[]): string {
  return `# ${project.applicationName} Playwright Framework

Generated by StatQA from real site evidence, not from a fake demo template.

## What this framework contains

- AI-generated manual tests in \`docs/manual-test-cases.md\`.
- Automation decisions in \`docs/automation-decisions.md\`.
- Observed site evidence in \`data/siteEvidence.json\`.
- AI-selected automation blueprints in \`data/automationBlueprints.json\`.
- Runnable Playwright specs in \`tests/generated/site-evidence.spec.ts\`.
- HTML, trace, screenshot, video, and CI reporting configuration.

## Evidence collected

- Pages analyzed: ${evidence.summary.pagesAnalyzed}
- Forms found: ${evidence.summary.formsFound}
- Buttons found: ${evidence.summary.buttonsFound}
- Internal links found: ${evidence.summary.internalLinksFound}
- Runnable generated tests: ${blueprints.length}

## Install

\`\`\`bash
npm install
npx playwright install
\`\`\`

## Configure

Copy \`.env.example\` to \`.env\`.

\`\`\`bash
cp .env.example .env
\`\`\`

## Run

\`\`\`bash
npm test
npm run test:generated
npm run test:headed
npm run report
\`\`\`

## Important quality rule

Runnable tests are generated only from public evidence StatQA observed: real URLs, titles, headings, text, buttons, and internal links. Private flows, destructive actions, checkout, login, admin, and form submissions are intentionally left as manual or needs-clarification unless the site evidence safely supports them.

If the site changes after generation, regenerate the framework or update \`data/siteEvidence.json\` and the generated specs.
`;
}

function siteAnalysisDoc(evidence: SiteEvidence): string {
  return [
    "# Site Analysis Evidence",
    "",
    `Target: ${evidence.targetUrl}`,
    `Status: ${evidence.status}`,
    evidence.error ? `Error: ${evidence.error}` : "",
    "",
    "## Summary",
    "",
    `- Pages analyzed: ${evidence.summary.pagesAnalyzed}`,
    `- Forms found: ${evidence.summary.formsFound}`,
    `- Inputs found: ${evidence.summary.inputsFound}`,
    `- Buttons found: ${evidence.summary.buttonsFound}`,
    `- Internal links found: ${evidence.summary.internalLinksFound}`,
    "",
    ...evidence.pages.flatMap((page) => [
      `## ${page.path}`,
      "",
      `URL: ${page.url}`,
      `HTTP status: ${page.status ?? "unknown"}`,
      `Title: ${page.title || "No title observed"}`,
      "",
      "### Headings",
      "",
      ...(page.headings.length ? page.headings.map((heading) => `- ${heading.text}`) : ["- None observed"]),
      "",
      "### Buttons",
      "",
      ...(page.buttons.length ? page.buttons.map((button) => `- ${button.text}`) : ["- None observed"]),
      "",
      "### Internal links",
      "",
      ...(page.links.filter((link) => link.internal).slice(0, 10).map((link) => `- ${link.text || link.href}: ${link.href}`) || ["- None observed"]),
      ""
    ])
  ].filter(Boolean).join("\n");
}

function manualTestsDoc(tests: ManualFrameworkTest[]): string {
  return [
    "# Manual Test Cases",
    "",
    "These are the source QA cases. Automatable ones are mapped in `docs/automation-decisions.md` and compiled into `tests/generated/site-evidence.spec.ts` when evidence supports them.",
    "",
    ...tests.flatMap((test) => [
      `## ${test.id}: ${test.title}`,
      "",
      `Feature: ${test.feature}`,
      `Priority: ${test.priority}`,
      `Severity: ${test.severity}`,
      `Classification: ${test.classification}`,
      `Automation suitability: ${test.automationSuitability}`,
      "",
      `Objective: ${test.objective}`,
      "",
      "### Preconditions",
      ...test.preconditions.map((item) => `- ${item}`),
      "",
      "### Test data",
      ...test.testData.map((item) => `- ${item}`),
      "",
      "### Steps",
      ...test.steps.map((step, index) => `${index + 1}. ${step.action}\n   Expected: ${step.expectedResult}`),
      "",
      `Final expected result: ${test.finalExpectedResult}`,
      "",
      `Automation notes: ${test.automationNotes}`,
      `Tester notes: ${test.testerNotes}`,
      ""
    ])
  ].join("\n");
}

function automationDoc(tests: ManualFrameworkTest[], suitability: SuitabilityResult[]): string {
  return [
    "# Automation Decisions",
    "",
    "StatQA only exports runnable code for tests backed by observed site evidence. Anything that requires hidden credentials, private data, destructive actions, or unobserved routes stays manual or needs clarification.",
    "",
    "| Test | Recommendation | Score | Layer | Maintenance | Reasons | Blockers |",
    "| --- | --- | ---: | --- | --- | --- | --- |",
    ...tests.map((test) => {
      const decision = suitability.find((item) => item.testCaseId === test.id);
      return `| ${test.id} ${escapeMarkdownTable(test.title)} | ${decision?.recommendation ?? "manual-only"} | ${decision?.score ?? 0} | ${decision?.recommendedAutomationLayer ?? "none"} | ${decision?.maintenanceRisk ?? "medium"} | ${escapeMarkdownTable(decision?.reasons.join(", ") ?? "")} | ${escapeMarkdownTable(decision?.blockers.join(", ") ?? "")} |`;
    })
  ].join("\n");
}

function strategyDoc(project: FrameworkRequest, evidence: SiteEvidence): string {
  return `# Test Strategy

## Approach

This framework was generated from real browser evidence for ${project.applicationName}. StatQA analyzed public pages before asking AI to create manual tests and automation blueprints.

## Automation scope

- Page availability and public rendering.
- Stable observed titles, headings, text snippets, buttons, and links.
- Same-origin internal link reachability.

## Manual or needs-clarification scope

- Login and private dashboards unless credentials and routes are explicitly confirmed.
- Form submission, payments, checkout, admin, create/edit/delete, and side-effect flows.
- Subjective layout and visual review.

## Observed evidence

- Pages analyzed: ${evidence.summary.pagesAnalyzed}
- Forms: ${evidence.summary.formsFound}
- Buttons: ${evidence.summary.buttonsFound}
- Internal links: ${evidence.summary.internalLinksFound}

## User-provided risk areas

${project.riskAreas.map((risk) => `- ${risk}`).join("\n")}
`;
}

function qualityChecklist(): string {
  return `# Quality Checklist

Before committing this framework to a production repository:

- [ ] Run \`npm install\`.
- [ ] Run \`npx playwright install\`.
- [ ] Copy \`.env.example\` to \`.env\`.
- [ ] Run \`npm test\`.
- [ ] Review \`data/siteEvidence.json\`.
- [ ] Review all manual cases.
- [ ] Confirm that every automated test maps to an observed page or link.
- [ ] Add credential-based tests only after safe test accounts are available.
- [ ] Add form submission tests only after expected side effects are clear.
- [ ] Keep generated tests readable and risk-based.
`;
}

function testMetadata(project: FrameworkRequest, evidence: SiteEvidence): string {
  return `export const testMetadata = {
  applicationName: ${JSON.stringify(project.applicationName)},
  baseUrl: process.env.BASE_URL,
  generatedBy: "StatQA AI evidence framework builder",
  analyzedAt: ${JSON.stringify(evidence.analyzedAt)},
  pagesAnalyzed: ${evidence.summary.pagesAnalyzed},
  riskAreas: ${JSON.stringify(project.riskAreas, null, 2)}
} as const;
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

function textHelper(): string {
  return `export function normalizeText(value: string): string {
  return value.replace(/\\s+/g, " ").trim();
}
`;
}

function publicPageObject(): string {
  return `import { expect, type Page } from "@playwright/test";

export class PublicPage {
  constructor(private readonly page: Page) {}

  async goto(path: string): Promise<void> {
    const response = await this.page.goto(path, { waitUntil: "domcontentloaded" });
    expect(response?.status() ?? 0).toBeLessThan(400);
    await expect(this.page.locator("body")).toBeVisible();
  }

  async assertBodyContains(text: string): Promise<void> {
    await expect(this.page.locator("body")).toContainText(text);
  }
}
`;
}

function githubWorkflow(): string {
  return `name: Playwright Evidence Tests

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
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-html-report
          path: reports/html-report
`;
}

function interviewScript(project: FrameworkRequest): string {
  return `# Interview Demo Script

1. Explain that ${project.applicationName} was analyzed with Playwright before tests were generated.
2. Open \`data/siteEvidence.json\` and show the observed pages, headings, buttons, links, and forms.
3. Open \`docs/manual-test-cases.md\` and show the risk-based manual cases.
4. Open \`docs/automation-decisions.md\` and explain why some tests are automated and others are not.
5. Open \`tests/generated/site-evidence.spec.ts\` and show the runnable evidence-backed Playwright tests.
6. Run \`npm test\` and open the HTML report.
7. Be honest: this is a strong starting framework, not a magical replacement for QA review.
`;
}

function frameworkFile(path: string, purpose: string, language: FrameworkLanguage, content: string): GeneratedFrameworkFile {
  return { path, purpose, language, content, required: true };
}

function calculateQuality(evidence: SiteEvidence, blueprints: AutomationBlueprint[], validation: FrameworkValidation): FrameworkBuilderResult["quality"] {
  const evidenceBackedAssertions = blueprints.reduce((sum, item) => sum + item.assertions.length, 0);
  const base = evidence.pages.length ? 50 : 0;
  const pageScore = Math.min(20, evidence.pages.length * 4);
  const assertionScore = Math.min(20, evidenceBackedAssertions * 2);
  const validationScore = validation.exportReady ? 10 : 0;
  return {
    readinessScore: Math.min(100, base + pageScore + assertionScore + validationScore),
    runnableSpecCount: blueprints.length ? 1 : 0,
    evidenceBackedAssertions,
    aiBlueprintsUsed: blueprints.length
  };
}

function compactEvidence(evidence: SiteEvidence) {
  return {
    targetUrl: evidence.targetUrl,
    origin: evidence.origin,
    status: evidence.status,
    summary: evidence.summary,
    pages: evidence.pages.map((page) => ({
      url: page.url,
      path: page.path,
      status: page.status,
      title: page.title,
      headings: page.headings.map((item) => item.text).slice(0, 8),
      buttons: page.buttons.map((item) => item.text).slice(0, 8),
      internalLinks: page.links.filter((link) => link.internal).slice(0, 12),
      inputs: page.inputs.slice(0, 8),
      forms: page.forms.slice(0, 5),
      textSnippets: page.textSnippets.slice(0, 8)
    }))
  };
}

function clean(value?: string): string {
  return value?.trim() ?? "";
}

function normalizeList(value: string[] | undefined, fallback: string[]): string[] {
  const cleaned = (value ?? []).map((item) => item.trim()).filter(Boolean);
  return cleaned.length ? cleaned : fallback;
}

function stringArray(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : fallback;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function normalizeTags(tags: string[]): string[] {
  const normalized = tags.map((tag) => tag.toLowerCase().replace(/^@/, "").replace(/[^a-z0-9-]+/g, "-")).filter(Boolean);
  return Array.from(new Set(normalized.length ? normalized : ["regression"])).slice(0, 5);
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

function escapeForDoubleQuote(value: string): string {
  return value.replace(/"/g, "'");
}

function escapeMarkdownTable(value: string): string {
  return value.replace(/\|/g, "/").replace(/\n/g, " ");
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "statqa-framework";
}
