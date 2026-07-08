import assert from "node:assert/strict";
import test from "node:test";
import { buildFrameworkPackage, normalizeFrameworkRequest } from "../services/qaFramework.js";

test("normalizeFrameworkRequest requires a real application URL", () => {
  assert.throws(
    () => normalizeFrameworkRequest({}),
    /real application URL/
  );
});

test("normalizeFrameworkRequest derives safe defaults from a real URL", () => {
  const project = normalizeFrameworkRequest({
    applicationUrl: "https://bookflow.example.test",
    supportedBrowsers: ["chromium"],
    includeCi: false,
    portfolioMode: false
  });

  assert.equal(project.applicationName, "bookflow.example.test");
  assert.equal(project.applicationUrl, "https://bookflow.example.test");
  assert.deepEqual(project.supportedBrowsers, ["chromium"]);
  assert.equal(project.includeCi, false);
  assert.equal(project.portfolioMode, false);
  assert.equal(project.mainRoles.includes("Visitor"), true);
  assert.equal(project.riskAreas.includes("Broken navigation"), true);
});

test("buildFrameworkPackage rejects missing URL before attempting browser analysis", async () => {
  await assert.rejects(
    buildFrameworkPackage({}),
    /real application URL/
  );
});
