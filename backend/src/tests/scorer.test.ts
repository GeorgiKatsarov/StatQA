import test from "node:test";
import assert from "node:assert/strict";
import { scoreIssues } from "../services/scorer.js";
import type { Issue } from "../types/index.js";

function makeIssue(severity: Issue["severity"]): Issue {
  return {
    id: severity,
    pageUrl: "https://example.com",
    category: "meta",
    severity,
    message: severity,
    explanation: severity,
    recommendation: severity
  };
}

test("scoreIssues applies severity penalties", () => {
  const result = scoreIssues([makeIssue("critical"), makeIssue("warning"), makeIssue("info")]);
  assert.equal(result.score, 77);
  assert.equal(result.healthLabel, "Good");
});

