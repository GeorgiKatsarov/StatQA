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
    buttons: [
      {
        text: "",
        label: "",
        type: "button",
        visible: true,
        disabled: false,
        formIndex: null
      }
    ],
    inputs: [
      {
        type: "text",
        name: null,
        label: null,
        required: false,
        placeholder: null,
        visible: true,
        disabled: false,
        editable: true,
        formIndex: 1
      }
    ],
    forms: [
      {
        action: null,
        method: "get",
        hasSubmitButton: true,
        inputCount: 1,
        editableInputCount: 1,
        requiredInputCount: 0,
        kind: "search"
      }
    ],
    images: [{ src: "https://example.com/image.jpg", alt: null, loaded: false, naturalWidth: 0, naturalHeight: 0 }],
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
    },
    securitySignals: {
      isHttps: true,
      responseHeaders: {},
      mixedContentUrls: ["http://example.com/insecure.js"],
      insecureFormActions: [],
      passwordFieldsOnInsecurePage: 0
    },
    behaviorChecks: [
      {
        id: "search-failed",
        pageUrl: "https://example.com",
        category: "search",
        target: "search form 1",
        status: "failed",
        message: "search form 1 did not navigate or send a request after deterministic submission.",
        meta: {
          formKind: "search",
          method: "get",
          changedUrl: false,
          requestSeen: false
        }
      },
      {
        id: "button-failed",
        pageUrl: "https://example.com",
        category: "button",
        target: "button 1",
        status: "failed",
        message: "button 1 did not navigate, send a request, expand, or visibly change page content after a click.",
        meta: {
          changedUrl: false,
          requestSeen: false,
          textChanged: false,
          expandedChanged: false
        }
      }
    ],
    pageScreenshot: {
      dataUrl: "data:image/png;base64,test",
      width: 100,
      height: 80,
      highlight: {
        x: 0,
        y: 0,
        width: 100,
        height: 80
      }
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
  assert.equal(categories.has("behavior"), true);
  assert.equal(categories.has("security"), true);
  assert.equal(issues.some((issue) => issue.message === "Image failed to load"), true);
  assert.equal(issues.some((issue) => issue.message === "Button click did not respond"), true);
  assert.equal(issues.some((issue) => issue.message === "Mixed content resources detected"), true);
  assert.equal(issues.every((issue) => issue.screenshot?.dataUrl === "data:image/png;base64,test"), true);
});
