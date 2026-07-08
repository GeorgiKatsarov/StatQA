import assert from "node:assert/strict";
import test from "node:test";
import { buildFrameworkPackage, normalizeFrameworkRequest } from "../services/qaFramework.js";

test("normalizeFrameworkRequest provides a complete TaskPilot default", () => {
  const project = normalizeFrameworkRequest({});

  assert.equal(project.applicationName, "TaskPilot");
  assert.equal(project.supportedBrowsers.includes("chromium"), true);
  assert.equal(project.includeCi, true);
  assert.equal(project.portfolioMode, true);
});

test("buildFrameworkPackage creates manual tests, suitability decisions, and export-ready files", () => {
  const framework = buildFrameworkPackage({
    applicationName: "BookFlow",
    applicationUrl: "https://bookflow.example.test",
    productDescription: "Booking app for customers and support agents.",
    mainRoles: ["Admin", "Agent", "Customer"],
    criticalFlows: ["Login", "Create booking", "Cancel booking"],
    businessRules: ["Customers cannot cancel after check-in"],
    riskAreas: ["Payments", "Permissions"],
    supportedBrowsers: ["chromium", "firefox"],
    includeCi: true,
    portfolioMode: true
  });

  assert.equal(framework.project.applicationName, "BookFlow");
  assert.equal(framework.manualTests.length, 5);
  assert.equal(framework.suitability.length, framework.manualTests.length);
  assert.equal(framework.validation.exportReady, true);
  assert.equal(framework.validation.blockingErrors.length, 0);
  assert.equal(framework.files.some((file) => file.path === "playwright.config.ts"), true);
  assert.equal(framework.files.some((file) => file.path === "docs/manual-test-cases.md"), true);
  assert.equal(framework.files.some((file) => file.path === "data/manualTestCases.json"), true);
  assert.equal(framework.files.some((file) => file.path === "fixtures/auth.fixture.ts"), true);
  assert.equal(framework.files.some((file) => file.path === "pages/CoreWorkflowPage.ts"), true);
  assert.equal(framework.files.some((file) => file.path === "config/testMetadata.ts"), true);
  assert.equal(framework.files.some((file) => file.path === ".github/workflows/playwright.yml"), true);
  assert.equal(framework.files.some((file) => file.path === "docs/interview-demo-script.md"), true);
  assert.equal(
    framework.files.find((file) => file.path === ".env.example")?.content.includes("replace-with-test-password"),
    true
  );
});

test("buildFrameworkPackage respects disabled CI and portfolio options", () => {
  const framework = buildFrameworkPackage({
    includeCi: false,
    portfolioMode: false,
    supportedBrowsers: ["webkit"]
  });

  assert.equal(framework.files.some((file) => file.path === ".github/workflows/playwright.yml"), false);
  assert.equal(framework.files.some((file) => file.path === "docs/interview-demo-script.md"), false);
  assert.equal(framework.files.find((file) => file.path === "playwright.config.ts")?.content.includes('name: "webkit"'), true);
});
