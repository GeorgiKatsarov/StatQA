import test from "node:test";
import assert from "node:assert/strict";
import { validatePage } from "../services/validator.js";
import type { ScrapedData } from "../types/index.js";

function makeScrapedData(): ScrapedData {
  return {
    url: "https://example.com",
    finalUrl: "https://example.com",
    title: "",
    description: "",
    lang: "",
    headings: [],
    links: [{ href: "https://example.com/about", text: "", isInternal: true }],
    buttons: [],
    inputs: [{ type: "text", name: null, label: null, required: false, placeholder: null }],
    forms: [{ action: null, method: "post", hasSubmitButton: false }],
    images: [{ src: "https://example.com/image.jpg", alt: null }],
    videos: [],
    iframes: [],
    landmarks: [],
    textContent: "todo",
    domNodeCount: 1800,
    scriptCount: 25,
    consoleErrors: ["ReferenceError: test"],
    loadTimeMs: 5000,
    accessibilitySignals: {
      unlabeledInputs: 1,
      landmarksPresent: []
    }
  };
}

test("validatePage returns expected issue categories for obvious failures", () => {
  const issues = validatePage(makeScrapedData());
  const categories = new Set(issues.map((issue) => issue.category));

  assert.equal(issues.some((issue) => issue.message === "Missing page title"), true);
  assert.equal(categories.has("meta"), true);
  assert.equal(categories.has("performance"), true);
  assert.equal(categories.has("console"), true);
  assert.equal(categories.has("content"), true);
});
