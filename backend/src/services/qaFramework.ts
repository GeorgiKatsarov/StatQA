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

export async function buildFrameworkPackage(input: Partial<FrameworkRequest>): Promise<FrameworkBuilderResult> {
  const result = await buildRuntimeFrameworkPackage(input);

  return {
    ...result,
    files: result.files.map(enhanceGeneratedFile)
  };
}

function enhanceGeneratedFile(file: GeneratedFrameworkFile): GeneratedFrameworkFile {
  if (file.path === "package.json") {
    return enhancePackageJson(file);
  }

  if (file.path === "README.md") {
    return {
      ...file,
      content: `${file.content.trim()}

## Common run commands

Run all generated tests:

\`\`\`bash
npm test
\`\`\`

Run headed mode:

\`\`\`bash
npm run test:headed
\`\`\`

Run headed mode with one worker:

\`\`\`bash
npm run test:headed:single
\`\`\`

When passing Playwright options through npm manually, use npm's argument separator:

\`\`\`bash
npm run test:headed -- --workers=1
\`\`\`

Do not use \`workers:1\`; Playwright treats that as a test-name filter and may report \"No tests found\".
`
    };
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
      "test:single": "playwright test --workers=1",
      "test:headed:single": "playwright test --headed --workers=1",
      "test:debug": "playwright test --debug",
      "test:list": "playwright test --list"
    };

    return {
      ...file,
      content: JSON.stringify(packageJson, null, 2)
    };
  } catch {
    return file;
  }
}
