import type { AnalysisOptions, Issue, ScrapedData, SecurityCheck, TestSuite } from "../types/index.js";
import { findBasicSpellingSignals } from "./spellcheck.js";

function makeIssue(
  pageUrl: string,
  category: Issue["category"],
  severity: Issue["severity"],
  message: string,
  explanation: string,
  recommendation: string,
  meta?: Issue["meta"],
  evidence?: Pick<Issue, "selector" | "screenshot">
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
    selector: evidence?.selector,
    screenshot: evidence?.screenshot,
    meta
  };
}

function getSecurityCheck(issue: Issue): SecurityCheck | undefined {
  const check = issue.meta?.securityCheck;
  return typeof check === "string" ? (check as SecurityCheck) : undefined;
}

function issueMatchesOptions(issue: Issue, options: Pick<AnalysisOptions, "testSuites" | "securityChecks">): boolean {
  const suites = options.testSuites;
  if (issue.category === "behavior") {
    return suites.includes("behavior");
  }

  if (issue.category === "security") {
    const check = getSecurityCheck(issue);
    return suites.includes("security") && (!check || options.securityChecks.includes(check));
  }

  return suites.includes("content");
}

export function validatePage(
  scraped: ScrapedData,
  options: Pick<AnalysisOptions, "testSuites" | "securityChecks"> = {
    testSuites: ["content", "behavior", "security"],
    securityChecks: ["https", "hsts", "csp", "clickjacking", "mixed-content", "insecure-forms", "password-http"]
  }
): Issue[] {
  const issues: Issue[] = [];
  const securityHeaders = scraped.securitySignals.responseHeaders;

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

  if (!scraped.securitySignals.isHttps) {
    issues.push(
      makeIssue(
        scraped.url,
        "security",
        "critical",
        "Page is not served over HTTPS",
        "The page uses an insecure HTTP connection, which can expose user traffic and reduce browser trust.",
        "Serve the page over HTTPS and redirect HTTP traffic to the secure URL.",
        { finalUrl: scraped.finalUrl, securityCheck: "https" },
        { screenshot: scraped.pageScreenshot }
      )
    );
  }

  if (!securityHeaders["strict-transport-security"] && scraped.securitySignals.isHttps) {
    issues.push(
      makeIssue(
        scraped.url,
        "security",
        "warning",
        "Missing HSTS header",
        "The page does not advertise HTTP Strict Transport Security, so browsers may not automatically enforce HTTPS on future visits.",
        "Add a Strict-Transport-Security header with an appropriate max-age after HTTPS is stable.",
        { header: "strict-transport-security", securityCheck: "hsts" },
        { screenshot: scraped.pageScreenshot }
      )
    );
  }

  if (!securityHeaders["content-security-policy"]) {
    issues.push(
      makeIssue(
        scraped.url,
        "security",
        "warning",
        "Missing Content Security Policy",
        "The page does not send a Content-Security-Policy header, which limits browser protection against injected scripts and unsafe resources.",
        "Add a Content-Security-Policy header that allows only the scripts, styles, frames, and media sources the site needs.",
        { header: "content-security-policy", securityCheck: "csp" },
        { screenshot: scraped.pageScreenshot }
      )
    );
  }

  if (!securityHeaders["x-frame-options"] && !/frame-ancestors/i.test(securityHeaders["content-security-policy"] ?? "")) {
    issues.push(
      makeIssue(
        scraped.url,
        "security",
        "warning",
        "Missing clickjacking protection",
        "The page does not send X-Frame-Options or a CSP frame-ancestors directive.",
        "Set X-Frame-Options or add a frame-ancestors directive to the Content-Security-Policy header.",
        { checkedHeaders: "x-frame-options, content-security-policy", securityCheck: "clickjacking" },
        { screenshot: scraped.pageScreenshot }
      )
    );
  }

  if (scraped.securitySignals.mixedContentUrls.length > 0) {
    issues.push(
      makeIssue(
        scraped.url,
        "security",
        "error",
        "Mixed content resources detected",
        "The page references insecure HTTP resources that can be blocked by browsers or modified in transit.",
        "Load scripts, images, frames, and stylesheets over HTTPS.",
        {
          count: scraped.securitySignals.mixedContentUrls.length,
          firstUrl: scraped.securitySignals.mixedContentUrls[0],
          securityCheck: "mixed-content"
        },
        { screenshot: scraped.pageScreenshot }
      )
    );
  }

  for (const insecureForm of scraped.securitySignals.insecureFormActions) {
    issues.push(
      makeIssue(
        scraped.url,
        "security",
        "error",
        "Form submits to an insecure URL",
        "A form action points to HTTP, which can expose submitted user data.",
        "Change the form action to an HTTPS endpoint.",
        { action: insecureForm.action, securityCheck: "insecure-forms" },
        { selector: insecureForm.selector, screenshot: scraped.pageScreenshot }
      )
    );
  }

  if (scraped.securitySignals.passwordFieldsOnInsecurePage > 0) {
    issues.push(
      makeIssue(
        scraped.url,
        "security",
        "critical",
        "Password field on insecure page",
        "The page contains password inputs while not being served over HTTPS.",
        "Move login and account pages to HTTPS before collecting passwords.",
        { passwordFields: scraped.securitySignals.passwordFieldsOnInsecurePage, securityCheck: "password-http" },
        { screenshot: scraped.pageScreenshot }
      )
    );
  }

  scraped.inputs.forEach((input, index) => {
    if (!input.editable || !input.visible) {
      return;
    }

    const parentForm = input.formIndex ? scraped.forms[input.formIndex - 1] : undefined;
    const participatesInSubmission = Boolean(parentForm?.hasSubmitButton);
    const inputType = (input.type || "text").toLowerCase();
    const shouldHaveSubmittedName =
      participatesInSubmission && !["checkbox", "radio"].includes(inputType) && parentForm?.kind !== "login";

    if (shouldHaveSubmittedName && !input.name) {
      issues.push(
        makeIssue(
          scraped.url,
          "inputs",
          "warning",
          "Submitted input missing name attribute",
          "A visible control inside a submitted form has no name, so its value may not be sent.",
          "Add a stable name to controls that should be submitted.",
          {
            inputType: input.type || "unspecified",
            label: input.label || "unlabeled",
            placeholder: input.placeholder || "none",
            formKind: parentForm?.kind || "unknown",
            fieldIndex: index + 1
          },
          { selector: input.selector, screenshot: input.screenshot }
        )
      );
    }

    if (!input.label && !input.placeholder) {
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
            formKind: parentForm?.kind || "standalone",
            fieldIndex: index + 1
          },
          { selector: input.selector, screenshot: input.screenshot }
        )
      );
    }
  });

  scraped.forms.forEach((form, index) => {
    if (form.editableInputCount > 0 && !form.hasSubmitButton) {
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
            formKind: form.kind,
            editableInputCount: form.editableInputCount,
            formIndex: index + 1
          },
          { selector: form.selector, screenshot: form.screenshot }
        )
      );
    }
  });

  scraped.buttons.forEach((button, index) => {
    if (!button.visible || button.disabled || button.formIndex !== null) {
      return;
    }

    if (!button.label) {
      issues.push(
        makeIssue(
          scraped.url,
          "accessibility",
          "error",
          "Button missing accessible name",
          "A visible button has no text, aria-label, or title, so users may not know what it does.",
          "Add visible text or an accessible name to the button.",
          {
            buttonIndex: index + 1,
            type: button.type || "button"
          },
          { selector: button.selector, screenshot: button.screenshot }
        )
      );
    }
  });

  for (const check of scraped.behaviorChecks) {
    if (check.status !== "failed") {
      continue;
    }

    const isSearch = check.category === "search";
    const isButton = check.category === "button";
    const isLink = check.category === "link";

    issues.push(
      makeIssue(
        scraped.url,
        "behavior",
        isSearch || isLink ? "error" : "warning",
        isSearch
          ? "Search submission did not respond"
          : isButton
            ? "Button click did not respond"
            : isLink
              ? "Important link did not open"
              : "Form submission did not respond",
        check.message,
        isSearch
          ? "Make sure the search form submits a query, navigates, or visibly updates results."
          : isButton
            ? "Wire the button to a visible state change, navigation, request, or remove it if it is decorative."
            : isLink
              ? "Fix the target URL or route so important user paths do not lead to broken pages."
              : "Make sure the form has a working submit path and gives users clear feedback.",
        check.meta,
        { selector: check.selector, screenshot: check.screenshot }
      )
    );
  }

  for (const image of scraped.images) {
    if (image.src && !image.loaded) {
      issues.push(
        makeIssue(
          scraped.url,
          "images",
          "error",
          "Image failed to load",
          "An image element did not finish loading successfully.",
          "Fix the image URL, remove the broken element, or provide a working fallback.",
          {
            src: image.src,
            naturalWidth: image.naturalWidth,
            naturalHeight: image.naturalHeight
          },
          { selector: image.selector, screenshot: image.screenshot }
        )
      );
    }

    if (image.alt === null) {
      issues.push(
        makeIssue(
          scraped.url,
          "images",
          "warning",
          "Image missing alt text",
          "An image is missing an alt attribute.",
          "Add descriptive alt text or an empty alt for decorative images.",
          { src: image.src },
          { selector: image.selector, screenshot: image.screenshot }
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
          { href: link.href, isInternal: link.isInternal },
          { selector: link.selector, screenshot: link.screenshot }
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

  const issuesWithFallbackScreenshots = scraped.pageScreenshot
    ? issues.map((issue) => ({
        ...issue,
        screenshot: issue.screenshot ?? scraped.pageScreenshot
      }))
    : issues;

  return issuesWithFallbackScreenshots.filter((issue) => issueMatchesOptions(issue, options));
}
