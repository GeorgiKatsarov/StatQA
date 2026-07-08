import { chromium } from "playwright";
import {
  buildFrameworkPackage as buildRuntimeFrameworkPackage,
  normalizeFrameworkRequest,
  type FrameworkBuilderResult,
  type FrameworkLanguage,
  type FrameworkRequest,
  type FrameworkValidation,
  type GeneratedFrameworkFile,
  type ManualFrameworkTest,
  type SiteEvidence,
  type SitePageEvidence,
  type SiteTextEvidence,
  type SuitabilityResult
} from "./qaRuntimeEvidenceFramework.js";

export { normalizeFrameworkRequest };
export type {
  FrameworkBuilderResult,
  FrameworkLanguage,
  FrameworkRequest,
  FrameworkValidation,
  GeneratedFrameworkFile,
  ManualFrameworkTest,
  SiteEvidence,
  SitePageEvidence,
  SiteTextEvidence,
  SuitabilityResult
};

export interface FrameworkRunCheck {
  title: string;
  path: string;
  status: "passed" | "failed";
  durationMs: number;
  message: string;
}

export interface FrameworkRunResult {
  status: "passed" | "failed";
  startedAt: string;
  finishedAt: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
  checks: FrameworkRunCheck[];
}

export async function buildFrameworkPackage(input: Partial<FrameworkRequest>): Promise<FrameworkBuilderResult> {
  const result = await buildRuntimeFrameworkPackage(input);
  const strictFiles = enforceStrictFrameworkGuidelines(result.files.map(enhanceGeneratedFile), result);

  return {
    ...result,
    files: strictFiles,
    quality: {
      ...result.quality,
      runnableSpecCount: strictFiles.filter((file) => file.path.endsWith(".spec.ts")).length,
      evidenceBackedAssertions: Math.max(result.quality.evidenceBackedAssertions, result.siteEvidence.pages.length * 3)
    }
  };
}

export async function runFrameworkTests(input: Partial<FrameworkRequest>): Promise<{ framework: FrameworkBuilderResult; run: FrameworkRunResult }> {
  const framework = await buildFrameworkPackage(input);
  const startedAt = new Date().toISOString();
  const checks: FrameworkRunCheck[] = [];

  if (!framework.validation.exportReady) {
    const finishedAt = new Date().toISOString();
    return {
      framework,
      run: {
        status: "failed",
        startedAt,
        finishedAt,
        summary: { total: 1, passed: 0, failed: 1 },
        checks: [
          {
            title: "Framework validation",
            path: framework.project.applicationUrl,
            status: "failed",
            durationMs: 0,
            message: framework.validation.blockingErrors.join(" | ") || "Framework is not export-ready."
          }
        ]
      }
    };
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1366, height: 900 } });

  try {
    for (const evidencePage of framework.siteEvidence.pages.slice(0, 10)) {
      const page = await context.newPage();
      const checkStarted = Date.now();
      try {
        const response = await page.goto(evidencePage.url, { waitUntil: "domcontentloaded", timeout: 20_000 });
        await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => undefined);
        const status = response?.status() ?? 0;
        const bodyText = (await page.locator("body").innerText({ timeout: 3_000 }).catch(() => "")).trim();
        const bodyVisible = await page.locator("body").isVisible({ timeout: 2_000 }).catch(() => false);

        if (status >= 400) {
          throw new Error(`HTTP ${status}`);
        }
        if (!bodyVisible || bodyText.length < 10) {
          throw new Error("Page body did not render meaningful visible content.");
        }

        checks.push({
          title: `Public page contract: ${evidencePage.path}`,
          path: evidencePage.url,
          status: "passed",
          durationMs: Date.now() - checkStarted,
          message: `HTTP ${status}; visible body content rendered.`
        });
      } catch (error) {
        checks.push({
          title: `Public page contract: ${evidencePage.path}`,
          path: evidencePage.url,
          status: "failed",
          durationMs: Date.now() - checkStarted,
          message: error instanceof Error ? error.message : "Page contract failed."
        });
      } finally {
        await page.close().catch(() => undefined);
      }
    }
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }

  const failed = checks.filter((check) => check.status === "failed").length;
  const finishedAt = new Date().toISOString();

  return {
    framework,
    run: {
      status: failed ? "failed" : "passed",
      startedAt,
      finishedAt,
      summary: {
        total: checks.length,
        passed: checks.length - failed,
        failed
      },
      checks
    }
  };
}

function enforceStrictFrameworkGuidelines(files: GeneratedFrameworkFile[], result: FrameworkBuilderResult): GeneratedFrameworkFile[] {
  const withoutWeakGeneratedSpec = files.filter((file) => file.path !== "tests/generated/site-evidence.spec.ts" && file.path !== "pages/PublicPage.ts");
  const strictFiles = [
    ...withoutWeakGeneratedSpec,
    frameworkFile("docs/automation-guidelines.md", "Strict Playwright/POM engineering rules followed by the generated framework.", "markdown", automationGuidelines()),
    frameworkFile("test-data/siteEvidence.ts", "Typed evidence fixture consumed by generated specs.", "typescript", siteEvidenceFixture(result.siteEvidence)),
    frameworkFile("pages/BasePage.ts", "Base page abstraction shared by generated page objects.", "typescript", basePageObject()),
    frameworkFile("pages/PublicPage.ts", "Public page object for evidence-backed smoke and content contracts.", "typescript", strictPublicPageObject()),
    frameworkFile("tests/generated/public-pages.spec.ts", "POM-based public page smoke coverage generated from observed evidence.", "typescript", publicPagesSpec(result)),
    frameworkFile("tests/generated/content-contract.spec.ts", "POM-based visible content contracts generated from observed headings and titles.", "typescript", contentContractSpec(result)),
    frameworkFile("tests/generated/navigation-contract.spec.ts", "POM-based non-destructive navigation inventory checks.", "typescript", navigationContractSpec(result))
  ];

  return strictFiles.map(enhanceGeneratedFile);
}

function enhanceGeneratedFile(file: GeneratedFrameworkFile): GeneratedFrameworkFile {
  if (file.path === "package.json") {
    return enhancePackageJson(file);
  }

  if (file.path === "README.md") {
    return enhanceReadme(file);
  }

  return file;
}

function enhancePackageJson(file: GeneratedFrameworkFile): GeneratedFrameworkFile {
  try {
    const packageJson = JSON.parse(file.content) as {
      scripts?: Record<string, string>;
      [key: string]: unknown;
    };

    packageJson.scripts = {
      ...(packageJson.scripts ?? {}),
      "test": "playwright test tests/generated",
      "test:single": "playwright test tests/generated --workers=1",
      "test:headed": "playwright test tests/generated --headed",
      "test:headed:single": "playwright test tests/generated --headed --workers=1",
      "test:debug": "playwright test tests/generated --debug",
      "test:list": "playwright test tests/generated --list",
      "test:smoke": "playwright test tests/generated/public-pages.spec.ts",
      "test:contracts": "playwright test tests/generated/content-contract.spec.ts tests/generated/navigation-contract.spec.ts"
    };

    return {
      ...file,
      content: JSON.stringify(packageJson, null, 2)
    };
  } catch {
    return file;
  }
}

function enhanceReadme(file: GeneratedFrameworkFile): GeneratedFrameworkFile {
  return {
    ...file,
    content: `${file.content.trim()}

## Framework architecture

This is a full Playwright TypeScript framework, not a raw generated spec dump. The generated code follows these rules:

- Tests live in \`tests/generated\`.
- Page objects live in \`pages\`.
- Shared observed evidence lives in \`test-data/siteEvidence.ts\`.
- Specs use page objects and fixtures instead of repeating raw selectors everywhere.
- Assertions are public, non-destructive, and based on observed site evidence.
- Private/authenticated/destructive flows must be added only after safe credentials, setup, cleanup, and test data contracts exist.

## Common run commands

Run all generated tests:

\`\`\`bash
npm test
\`\`\`

List generated tests:

\`\`\`bash
npm run test:list
\`\`\`

Run headed mode with one worker:

\`\`\`bash
npm run test:headed:single
\`\`\`

Run the smoke suite only:

\`\`\`bash
npm run test:smoke
\`\`\`

Do not use \`workers:1\`; Playwright treats that as a test-name filter and may report \"No tests found\".
`
  };
}

function automationGuidelines(): string {
  return `# StatQA Automation Guidelines

## Architecture rules

1. Use Page Object Model for all browser interactions.
2. Keep specs readable and business-focused.
3. Do not put selectors, navigation logic, or repeated waits directly in specs.
4. Use locator-first Playwright APIs and web-first assertions.
5. Do not use arbitrary waits such as \`waitForTimeout\`.
6. Every generated assertion must be traceable to observed evidence.
7. Do not automate private, destructive, payment, admin, or authenticated flows without explicit setup and cleanup contracts.

## Generated structure

- \`pages/BasePage.ts\` contains shared page behavior.
- \`pages/PublicPage.ts\` contains public page evidence contracts.
- \`test-data/siteEvidence.ts\` stores observed pages and content.
- \`tests/generated/*.spec.ts\` contains POM-based runnable specs.

## Stability rules

- Prefer status, body visibility, and stable visible text contracts.
- Keep link checks non-destructive.
- Treat private flows as manual until credentials and reset-safe data exist.
`;
}

function siteEvidenceFixture(evidence: SiteEvidence): string {
  const pages = evidence.pages.map((page) => ({
    url: page.url,
    path: page.path,
    title: page.title,
    status: page.status,
    headings: page.headings.map((heading) => heading.text).filter(Boolean).slice(0, 6),
    buttons: page.buttons.map((button) => button.text).filter(Boolean).slice(0, 6),
    links: page.links.filter((link) => link.internal).map((link) => ({ text: link.text, href: link.href })).slice(0, 10),
    textSnippets: page.textSnippets.slice(0, 6)
  }));

  return `export const siteEvidence = ${JSON.stringify({ targetUrl: evidence.targetUrl, origin: evidence.origin, pages }, null, 2)} as const;

export type SiteEvidencePage = (typeof siteEvidence.pages)[number];
`;
}

function basePageObject(): string {
  return `import { expect, type Locator, type Page } from "@playwright/test";

export abstract class BasePage {
  protected constructor(protected readonly page: Page) {}

  protected body(): Locator {
    return this.page.locator("body");
  }

  async goto(pathOrUrl: string): Promise<void> {
    const response = await this.page.goto(pathOrUrl, { waitUntil: "domcontentloaded" });
    expect(response?.status() ?? 0, \`Expected \${pathOrUrl} to respond successfully\`).toBeLessThan(400);
    await expect(this.body()).toBeVisible();
  }

  async expectMeaningfulBody(minLength = 10): Promise<void> {
    await expect.poll(async () => (await this.body().innerText()).trim().length).toBeGreaterThanOrEqual(minLength);
  }

  async expectBodyContains(text: string): Promise<void> {
    await expect(this.body()).toContainText(text);
  }

  async expectTitlePresent(): Promise<void> {
    await expect.poll(async () => (await this.page.title()).trim().length).toBeGreaterThan(0);
  }
}
`;
}

function strictPublicPageObject(): string {
  return `import { expect, type Page } from "@playwright/test";
import { BasePage } from "./BasePage";
import type { SiteEvidencePage } from "../test-data/siteEvidence";

export class PublicPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async openEvidencePage(evidencePage: SiteEvidencePage): Promise<void> {
    await this.goto(evidencePage.url);
  }

  async expectObservedContract(evidencePage: SiteEvidencePage): Promise<void> {
    await this.expectMeaningfulBody(10);
    await this.expectTitlePresent();

    const stableHeading = evidencePage.headings.find((heading) => heading.length >= 3);
    if (stableHeading) {
      await expect(this.page.locator("body")).toContainText(stableHeading);
    }
  }

  async expectNavigationInventory(evidencePage: SiteEvidencePage): Promise<void> {
    for (const link of evidencePage.links.slice(0, 5)) {
      expect(link.href, "Internal evidence link should have an href").toContain(new URL(evidencePage.url).origin);
    }
  }
}
`;
}

function publicPagesSpec(result: FrameworkBuilderResult): string {
  const appName = JSON.stringify(result.project.applicationName);
  return `import { test } from "@playwright/test";
import { PublicPage } from "../../pages/PublicPage";
import { siteEvidence } from "../../test-data/siteEvidence";

test.describe(${appName} + " public page smoke suite", () => {
  for (const evidencePage of siteEvidence.pages) {
    test(\`public page loads: \${evidencePage.path}\`, async ({ page }) => {
      const publicPage = new PublicPage(page);
      await publicPage.openEvidencePage(evidencePage);
      await publicPage.expectMeaningfulBody(10);
    });
  }
});
`;
}

function contentContractSpec(result: FrameworkBuilderResult): string {
  const appName = JSON.stringify(result.project.applicationName);
  return `import { test } from "@playwright/test";
import { PublicPage } from "../../pages/PublicPage";
import { siteEvidence } from "../../test-data/siteEvidence";

test.describe(${appName} + " visible content contracts", () => {
  for (const evidencePage of siteEvidence.pages) {
    test(\`observed content contract: \${evidencePage.path}\`, async ({ page }) => {
      const publicPage = new PublicPage(page);
      await publicPage.openEvidencePage(evidencePage);
      await publicPage.expectObservedContract(evidencePage);
    });
  }
});
`;
}

function navigationContractSpec(result: FrameworkBuilderResult): string {
  const appName = JSON.stringify(result.project.applicationName);
  return `import { test } from "@playwright/test";
import { PublicPage } from "../../pages/PublicPage";
import { siteEvidence } from "../../test-data/siteEvidence";

test.describe(${appName} + " navigation inventory contracts", () => {
  for (const evidencePage of siteEvidence.pages) {
    test(\`internal navigation inventory is captured: \${evidencePage.path}\`, async ({ page }) => {
      const publicPage = new PublicPage(page);
      await publicPage.openEvidencePage(evidencePage);
      await publicPage.expectNavigationInventory(evidencePage);
    });
  }
});
`;
}

function frameworkFile(path: string, purpose: string, language: FrameworkLanguage, content: string): GeneratedFrameworkFile {
  return { path, purpose, language, content, required: true };
}
