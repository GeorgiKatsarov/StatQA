import type { Issue, ScrapedData } from "../types/index.js";
import { findBasicSpellingSignals } from "./spellcheck.js";

function makeIssue(
  pageUrl: string,
  category: Issue["category"],
  severity: Issue["severity"],
  message: string,
  explanation: string,
  recommendation: string,
  meta?: Issue["meta"]
): Issue {
  const metaKey = meta ? JSON.stringify(meta) : "no-meta";
  const rawId = `${pageUrl}:${category}:${severity}:${message}:${metaKey}`;

  return {
    id: rawId.replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
    pageUrl,
    category,
    severity,
    message,
    explanation,
    recommendation,
    meta
  };
}

export function validatePage(scraped: ScrapedData): Issue[] {
  const issues: Issue[] = [];

  if (!scraped.title) {
    issues.push(
      makeIssue(
        scraped.url,
        "meta",
        "critical",
        "Missing page title",
        "The page has no title tag.",
        "Add a unique and descriptive title.",
        { inspectedUrl: scraped.finalUrl }
      )
    );
  }

  if (!scraped.description) {
    issues.push(
      makeIssue(
        scraped.url,
        "meta",
        "warning",
        "Missing meta description",
        "The page has no meta description.",
        "Add a concise page description.",
        { title: scraped.title || "Untitled page" }
      )
    );
  }

  if (!scraped.lang) {
    issues.push(
      makeIssue(
        scraped.url,
        "accessibility",
        "warning",
        "Missing HTML language",
        "The html element has no lang attribute.",
        "Set the page language on the html element.",
        { inspectedUrl: scraped.finalUrl }
      )
    );
  }

  if (!scraped.headings.some((heading) => heading.length > 0)) {
    issues.push(
      makeIssue(
        scraped.url,
        "structure",
        "error",
        "Missing heading structure",
        "No visible headings were detected.",
        "Add a meaningful heading hierarchy.",
        { headingCount: scraped.headings.length }
      )
    );
  }

  if (!scraped.landmarks.includes("main")) {
    issues.push(
      makeIssue(
        scraped.url,
        "structure",
        "warning",
        "Missing main landmark",
        "The page has no main landmark.",
        "Wrap the primary content in a main element.",
        { landmarks: scraped.landmarks.join(", ") || "none" }
      )
    );
  }

  scraped.inputs.forEach((input, index) => {
    if (!input.name) {
      issues.push(
        makeIssue(
          scraped.url,
          "inputs",
          "warning",
          "Input missing name attribute",
          "A form control is missing a name attribute.",
          "Add a stable name to each submitted input.",
          {
            inputType: input.type || "unspecified",
            label: input.label || "unlabeled",
            placeholder: input.placeholder || "none",
            fieldIndex: index + 1
          }
        )
      );
    }

    if (!input.label) {
      issues.push(
        makeIssue(
          scraped.url,
          "accessibility",
          "error",
          "Input missing visible label",
          "A control does not expose an associated label.",
          "Add a visible label or another accessible name.",
          {
            inputType: input.type || "unspecified",
            name: input.name || "missing",
            placeholder: input.placeholder || "none",
            fieldIndex: index + 1
          }
        )
      );
    }
  });

  scraped.forms.forEach((form, index) => {
    if (!form.hasSubmitButton) {
      issues.push(
        makeIssue(
          scraped.url,
          "forms",
          "warning",
          "Form missing submit action",
          "A form does not have a submit control.",
          "Add a visible submit button.",
          {
            action: form.action || "current page",
            method: form.method || "get",
            formIndex: index + 1
          }
        )
      );
    }
  });

  for (const image of scraped.images) {
    if (image.alt === null) {
      issues.push(
        makeIssue(
          scraped.url,
          "images",
          "warning",
          "Image missing alt text",
          "An image is missing an alt attribute.",
          "Add descriptive alt text or an empty alt for decorative images.",
          { src: image.src }
        )
      );
    }
  }

  for (const link of scraped.links) {
    if (!link.text) {
      issues.push(
        makeIssue(
          scraped.url,
          "links",
          "warning",
          "Link with empty text",
          "A link appears without readable text.",
          "Add descriptive anchor text.",
          { href: link.href, isInternal: link.isInternal }
        )
      );
    }
  }

  if (scraped.scriptCount > 20) {
    issues.push(makeIssue(scraped.url, "performance", "warning", "High script count", "The page loads a large number of scripts.", "Audit and reduce non-essential scripts.", { scriptCount: scraped.scriptCount }));
  }

  if (scraped.domNodeCount > 1500) {
    issues.push(makeIssue(scraped.url, "performance", "warning", "Large DOM detected", "The page contains a large DOM tree.", "Simplify markup or defer non-critical rendering.", { domNodeCount: scraped.domNodeCount }));
  }

  if (scraped.loadTimeMs > 4000) {
    issues.push(makeIssue(scraped.url, "performance", "warning", "Slow page load", "The page took longer than expected to load.", "Reduce blocking resources and page weight.", { loadTimeMs: scraped.loadTimeMs }));
  }

  for (const consoleError of scraped.consoleErrors) {
    issues.push(
      makeIssue(
        scraped.url,
        "console",
        "error",
        "JavaScript console error detected",
        "The page emitted a console error during analysis.",
        "Inspect and fix the failing client-side script.",
        { consoleError }
      )
    );
  }

  if (scraped.textContent.length < 120) {
    issues.push(
      makeIssue(
        scraped.url,
        "content",
        "warning",
        "Thin page content",
        "The page contains very little visible text.",
        "Ensure the page presents enough useful content.",
        { visibleTextLength: scraped.textContent.length }
      )
    );
  }

  for (const signal of findBasicSpellingSignals(scraped.textContent)) {
    issues.push(makeIssue(scraped.url, "content", "info", signal, "The page contains placeholder-style text.", "Replace placeholder copy with final production text."));
  }

  return issues;
}
