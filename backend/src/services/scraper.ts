import { chromium, type Page } from "playwright";
import type { BehaviorCheck, BehaviorTestConfig, IssueScreenshot, ScrapedData } from "../types/index.js";
import { isSameHostname } from "../utils/domain.js";

const screenshotPadding = 24;
export const defaultBehaviorConfig: BehaviorTestConfig = {
  testForms: true,
  testSearch: true,
  testButtons: true,
  testLinks: true,
  sampleText: "statqa test",
  sampleEmail: "statqa@example.com",
  samplePhone: "5550100",
  samplePassword: "StatQA-Test-123!",
  sampleUrl: "https://example.com"
};

function toScreenshotDataUrl(buffer: Buffer): string {
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

async function captureViewportScreenshot(page: Page): Promise<IssueScreenshot | undefined> {
  const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
  const buffer = await page.screenshot({ type: "png" });

  return {
    dataUrl: toScreenshotDataUrl(buffer),
    width: viewport.width,
    height: viewport.height,
    highlight: {
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height
    }
  };
}

async function captureElementScreenshot(page: Page, selector: string): Promise<IssueScreenshot | undefined> {
  const element = page.locator(selector).first();
  await element.scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => undefined);
  const box = await element.boundingBox({ timeout: 1500 }).catch(() => null);

  if (!box || box.width <= 0 || box.height <= 0) {
    return undefined;
  }

  const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
  const x = Math.min(Math.max(0, box.x - screenshotPadding), viewport.width - 1);
  const y = Math.min(Math.max(0, box.y - screenshotPadding), viewport.height - 1);
  const width = Math.max(1, Math.min(viewport.width - x, box.width + screenshotPadding * 2));
  const height = Math.max(1, Math.min(viewport.height - y, box.height + screenshotPadding * 2));
  const clip = {
    x,
    y,
    width,
    height
  };
  const buffer = await page.screenshot({ type: "png", clip });

  return {
    dataUrl: toScreenshotDataUrl(buffer),
    width: Math.round(clip.width),
    height: Math.round(clip.height),
    highlight: {
      x: Math.round(box.x - clip.x),
      y: Math.round(box.y - clip.y),
      width: Math.round(box.width),
      height: Math.round(box.height)
    }
  };
}

function isSensitiveForm(form: { kind: string; method: string | null }, inputs: Array<{ type: string | null }>): boolean {
  const types = inputs.map((input) => (input.type ?? "text").toLowerCase());
  return (
    form.kind === "login" ||
    types.some((type) => ["password", "file", "hidden"].includes(type)) ||
    types.some((type) => type.includes("card") || type.includes("payment"))
  );
}

async function fillForm(page: Page, formSelector: string, config: BehaviorTestConfig): Promise<void> {
  const fields = page.locator(
    `${formSelector} input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), ${formSelector} textarea, ${formSelector} select`
  );
  const count = Math.min(await fields.count(), 12);

  for (let index = 0; index < count; index += 1) {
    const field = fields.nth(index);
    const tagName = await field.evaluate((element) => element.tagName.toLowerCase()).catch(() => "");
    const type = ((await field.getAttribute("type").catch(() => null)) ?? "text").toLowerCase();

    if (!(await field.isVisible().catch(() => false)) || !(await field.isEnabled().catch(() => false))) {
      continue;
    }

    if (tagName === "select") {
      const options = await field.locator("option:not([disabled])").evaluateAll((optionsList) =>
        optionsList.map((option) => (option as HTMLOptionElement).value).filter(Boolean)
      );
      if (options[0]) {
        await field.selectOption(options[0]).catch(() => undefined);
      }
      continue;
    }

    if (type === "checkbox" || type === "radio") {
      await field.check().catch(() => undefined);
      continue;
    }

    if (type === "email") {
      await field.fill(config.sampleEmail).catch(() => undefined);
    } else if (type === "password") {
      await field.fill(config.samplePassword).catch(() => undefined);
    } else if (type === "tel") {
      await field.fill(config.samplePhone).catch(() => undefined);
    } else if (type === "number") {
      await field.fill("1").catch(() => undefined);
    } else if (type === "url") {
      await field.fill(config.sampleUrl).catch(() => undefined);
    } else {
      await field.fill(config.sampleText).catch(() => undefined);
    }
  }
}

async function submitForm(page: Page, formSelector: string): Promise<{ changedUrl: boolean; requestSeen: boolean }> {
  const initialUrl = page.url();
  let requestSeen = false;
  const requestListener = (request: { url: () => string; method: () => string }) => {
    if (request.url() !== initialUrl && ["GET", "POST"].includes(request.method())) {
      requestSeen = true;
    }
  };

  page.on("request", requestListener);
  try {
    const submitControl = page
      .locator(
        `${formSelector} button[type="submit"], ${formSelector} input[type="submit"], ${formSelector} button:not([type])`
      )
      .first();
    await Promise.all([
      page.waitForLoadState("domcontentloaded", { timeout: 3000 }).catch(() => undefined),
      submitControl
        .click({ timeout: 1500 })
        .catch(() =>
          page.locator(formSelector).evaluate((form) => {
            if (form instanceof HTMLFormElement) {
              form.requestSubmit();
            }
          })
        )
    ]);
    await page.waitForTimeout(700);
  } finally {
    page.off("request", requestListener);
  }

  return {
    changedUrl: page.url() !== initialUrl,
    requestSeen
  };
}

async function submitStandaloneSearch(
  page: Page,
  selector: string,
  config: BehaviorTestConfig
): Promise<{ changedUrl: boolean; requestSeen: boolean }> {
  const initialUrl = page.url();
  let requestSeen = false;
  const requestListener = (request: { url: () => string; method: () => string }) => {
    if (request.url() !== initialUrl && ["GET", "POST"].includes(request.method())) {
      requestSeen = true;
    }
  };

  page.on("request", requestListener);
  try {
    const input = page.locator(selector).first();
    await input.fill(config.sampleText, { timeout: 1500 });
    await Promise.all([
      page.waitForLoadState("domcontentloaded", { timeout: 3000 }).catch(() => undefined),
      input.press("Enter", { timeout: 1500 })
    ]);
    await page.waitForTimeout(700);
  } finally {
    page.off("request", requestListener);
  }

  return {
    changedUrl: page.url() !== initialUrl,
    requestSeen
  };
}

function isSearchInput(input: {
  type: string | null;
  name?: string | null;
  label?: string | null;
  placeholder?: string | null;
}): boolean {
  const text = [input.type, input.name, input.label, input.placeholder].join(" ").toLowerCase();
  return /\b(search|query|keyword|q)\b/.test(text);
}

function isDangerousButtonLabel(label: string): boolean {
  return /\b(delete|remove|destroy|archive|purchase|buy|checkout|order|pay|subscribe|unsubscribe|logout|log out|sign out)\b/i.test(
    label
  );
}

function isCandidateCtaLink(link: { href: string; text: string; isInternal: boolean; selector?: string }): boolean {
  if (!link.selector || !link.isInternal || !link.href.startsWith("http") || !link.text.trim()) {
    return false;
  }

  const text = link.text.toLowerCase();
  return /\b(shop|buy|book|start|get|contact|quote|demo|learn|view|details|read|checkout|cart|sign up|register)\b/.test(text);
}

async function clickButton(page: Page, selector: string): Promise<{
  changedUrl: boolean;
  requestSeen: boolean;
  textChanged: boolean;
  expandedChanged: boolean;
}> {
  const initialUrl = page.url();
  const initialText = await page.locator("body").innerText({ timeout: 1000 }).catch(() => "");
  const initialExpanded = await page.locator(selector).first().getAttribute("aria-expanded").catch(() => null);
  let requestSeen = false;
  const requestListener = (request: { url: () => string; method: () => string }) => {
    if (request.url() !== initialUrl && ["GET", "POST"].includes(request.method())) {
      requestSeen = true;
    }
  };

  page.on("request", requestListener);
  try {
    await Promise.all([
      page.waitForLoadState("domcontentloaded", { timeout: 2500 }).catch(() => undefined),
      page.locator(selector).first().click({ timeout: 1500 })
    ]);
    await page.waitForTimeout(500);
  } finally {
    page.off("request", requestListener);
  }

  const currentText = await page.locator("body").innerText({ timeout: 1000 }).catch(() => "");
  const currentExpanded = await page.locator(selector).first().getAttribute("aria-expanded").catch(() => null);

  return {
    changedUrl: page.url() !== initialUrl,
    requestSeen,
    textChanged: currentText !== initialText,
    expandedChanged: currentExpanded !== initialExpanded
  };
}

async function runBehaviorChecks(
  page: Page,
  pageUrl: string,
  forms: Array<{
    selector?: string;
    method: string | null;
    kind: "search" | "login" | "contact" | "newsletter" | "generic";
    hasSubmitButton: boolean;
    editableInputCount: number;
  }>,
  inputs: Array<{
    type: string | null;
    name?: string | null;
    label?: string | null;
    placeholder?: string | null;
    formIndex: number | null;
    editable?: boolean;
    selector?: string;
  }>,
  buttons: Array<{
    text: string;
    label: string;
    type: string | null;
    visible?: boolean;
    disabled?: boolean;
    formIndex: number | null;
    selector?: string;
  }>,
  links: Array<{
    href: string;
    text: string;
    isInternal: boolean;
    selector?: string;
  }>,
  config: BehaviorTestConfig = defaultBehaviorConfig
): Promise<BehaviorCheck[]> {
  const checks: BehaviorCheck[] = [];
  const originalUrl = page.url();

  if (config.testForms) for (const [index, form] of forms.slice(0, 4).entries()) {
    if (!form.selector || !form.hasSubmitButton || form.editableInputCount === 0) {
      continue;
    }

    const formInputs = inputs.filter((input) => input.formIndex === index + 1);
    const sensitive = isSensitiveForm(form, formInputs);
    const shouldSubmit = form.kind === "search" || ((form.method ?? "get").toLowerCase() === "get" && !sensitive);
    const target = `${form.kind} form ${index + 1}`;

    if (!shouldSubmit) {
      checks.push({
        id: `${pageUrl}:behavior:skipped:${target}`.replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
        pageUrl,
        category: "form",
        target,
        status: "skipped",
        message: "Skipped completed submission for a sensitive or state-changing form.",
        selector: form.selector,
        screenshot: await captureElementScreenshot(page, form.selector).catch(() => undefined),
        meta: {
          formKind: form.kind,
          method: form.method || "get"
        }
      });
      continue;
    }

    await fillForm(page, form.selector, config);
    const result = await submitForm(page, form.selector).catch(() => ({ changedUrl: false, requestSeen: false }));
    const screenshot = await captureViewportScreenshot(page).catch(() => undefined);
    const passed = result.changedUrl || result.requestSeen;

    checks.push({
      id: `${pageUrl}:behavior:${passed ? "passed" : "failed"}:${target}`.replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
      pageUrl,
      category: form.kind === "search" ? "search" : "form",
      target,
      status: passed ? "passed" : "failed",
      message: passed
        ? `${target} accepted deterministic input and submitted.`
        : `${target} did not navigate or send a request after deterministic submission.`,
      selector: form.selector,
      screenshot,
      meta: {
        formKind: form.kind,
        method: form.method || "get",
        changedUrl: result.changedUrl,
        requestSeen: result.requestSeen
      }
    });

    if (page.url() !== originalUrl) {
      await page.goto(originalUrl, { waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => undefined);
    }
  }

  const standaloneSearches = config.testSearch ? inputs
    .filter((input) => input.editable && input.formIndex === null && input.selector && isSearchInput(input))
    .slice(0, 2) : [];

  for (const [index, input] of standaloneSearches.entries()) {
    const target = `standalone search ${index + 1}`;
    const result = await submitStandaloneSearch(page, input.selector as string, config).catch(() => ({
      changedUrl: false,
      requestSeen: false
    }));
    const passed = result.changedUrl || result.requestSeen;

    checks.push({
      id: `${pageUrl}:behavior:${passed ? "passed" : "failed"}:${target}`.replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
      pageUrl,
      category: "search",
      target,
      status: passed ? "passed" : "failed",
      message: passed
        ? `${target} accepted deterministic input and submitted.`
        : `${target} did not navigate or send a request when Enter was pressed.`,
      selector: input.selector,
      screenshot: await captureViewportScreenshot(page).catch(() => undefined),
      meta: {
        changedUrl: result.changedUrl,
        requestSeen: result.requestSeen
      }
    });

    if (page.url() !== originalUrl) {
      await page.goto(originalUrl, { waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => undefined);
    }
  }

  const clickableButtons = config.testButtons ? buttons
    .filter((button) => {
      const type = (button.type ?? "button").toLowerCase();
      return (
        button.visible &&
        !button.disabled &&
        button.formIndex === null &&
        button.selector &&
        type !== "submit" &&
        !isDangerousButtonLabel(button.label || button.text)
      );
    })
    .slice(0, 4) : [];

  for (const [index, button] of clickableButtons.entries()) {
    const target = button.label || button.text || `button ${index + 1}`;
    const result = await clickButton(page, button.selector as string).catch(() => ({
      changedUrl: false,
      requestSeen: false,
      textChanged: false,
      expandedChanged: false
    }));
    const passed = result.changedUrl || result.requestSeen || result.textChanged || result.expandedChanged;

    checks.push({
      id: `${pageUrl}:behavior:${passed ? "passed" : "failed"}:${target}`.replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
      pageUrl,
      category: "button",
      target,
      status: passed ? "passed" : "failed",
      message: passed
        ? `${target} responded to a deterministic click.`
        : `${target} did not navigate, send a request, expand, or visibly change page content after a click.`,
      selector: button.selector,
      screenshot: await captureElementScreenshot(page, button.selector as string).catch(() => undefined),
      meta: {
        changedUrl: result.changedUrl,
        requestSeen: result.requestSeen,
        textChanged: result.textChanged,
        expandedChanged: result.expandedChanged
      }
    });

    if (page.url() !== originalUrl) {
      await page.goto(originalUrl, { waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => undefined);
    }
  }

  const ctaLinks = config.testLinks ? links.filter(isCandidateCtaLink).slice(0, 5) : [];

  for (const [index, link] of ctaLinks.entries()) {
    const target = link.text || `link ${index + 1}`;
    const result = await page.goto(link.href, { waitUntil: "domcontentloaded", timeout: 10000 })
      .then((response) => ({
        loaded: Boolean(response && response.status() < 400),
        status: response?.status() ?? 0,
        finalUrl: page.url()
      }))
      .catch((error: unknown) => ({
        loaded: false,
        status: 0,
        finalUrl: page.url(),
        error: error instanceof Error ? error.message.slice(0, 240) : "Unknown navigation error"
      }));

    checks.push({
      id: `${pageUrl}:behavior:${result.loaded ? "passed" : "failed"}:${target}`.replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
      pageUrl,
      category: "link",
      target,
      status: result.loaded ? "passed" : "failed",
      message: result.loaded
        ? `${target} opened a reachable internal page.`
        : `${target} did not open a reachable internal page.`,
      selector: link.selector,
      screenshot: await captureElementScreenshot(page, link.selector as string).catch(() => undefined),
      meta: {
        href: link.href,
        status: result.status,
        finalUrl: result.finalUrl,
        error: "error" in result ? result.error ?? null : null
      }
    });

    if (page.url() !== originalUrl) {
      await page.goto(originalUrl, { waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => undefined);
    }
  }

  return checks;
}

export async function scrapePage(url: string, behaviorConfig: BehaviorTestConfig = defaultBehaviorConfig): Promise<ScrapedData> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const consoleErrors: string[] = [];

  await page.addInitScript(() => {
    // Some sites ship bundles that call the esbuild/SWC __name helper without defining it.
    // Defining a no-op fallback keeps analysis from failing on those pages.
    (window as typeof window & { __name?: (fn: unknown, name?: string) => unknown }).__name ??= (
      fn: unknown
    ) => fn;
  });

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  const startTime = Date.now();

  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    const responseHeaders = response?.headers() ?? {};

    const data = await page.evaluate((currentUrl) => {
      const hostname = new URL(currentUrl).hostname;
      const toText = (value: string | null | undefined): string => (value ?? "").trim();
      const escapeSelector = (value: string): string => window.CSS?.escape(value) ?? value.replace(/"/g, '\\"');
      const escapeAttributeValue = (value: string): string => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      const searchableText = (value: string | null | undefined): string => toText(value).toLowerCase();

      const getSelector = (element: Element): string => {
        if (element.id) {
          return `#${escapeSelector(element.id)}`;
        }

        const parts: string[] = [];
        let current: Element | null = element;

        while (current && current !== document.documentElement) {
          const tagName = current.tagName.toLowerCase();
          const parent: Element | null = current.parentElement;

          if (!parent) {
            parts.unshift(tagName);
            break;
          }

          const sameTagSiblings = Array.from(parent.children as HTMLCollectionOf<Element>).filter(
            (child) => child.tagName.toLowerCase() === tagName
          );
          const index = sameTagSiblings.indexOf(current) + 1;
          parts.unshift(`${tagName}:nth-of-type(${index})`);

          if (parent === document.body) {
            break;
          }

          current = parent;
        }

        return `body > ${parts.join(" > ")}`;
      };

      const links = Array.from(document.querySelectorAll("a[href]")).map((anchor) => {
        const href = anchor.getAttribute("href") ?? "";
        let resolved = href;

        try {
          resolved = new URL(href, window.location.href).toString();
        } catch {
          resolved = href;
        }

        let isInternal = false;
        try {
          isInternal = new URL(resolved).hostname === hostname;
        } catch {
          isInternal = false;
        }

        return {
          href: resolved,
          text: toText(anchor.textContent),
          isInternal,
          selector: getSelector(anchor)
        };
      });

      const classifyForm = (form: HTMLFormElement): "search" | "login" | "contact" | "newsletter" | "generic" => {
        const text = [
          form.getAttribute("role"),
          form.getAttribute("action"),
          form.getAttribute("aria-label"),
          form.textContent,
          ...Array.from(form.querySelectorAll("input, textarea, select")).flatMap((field) => [
            field.getAttribute("type"),
            field.getAttribute("name"),
            field.getAttribute("placeholder"),
            field.getAttribute("aria-label"),
            field.getAttribute("autocomplete")
          ])
        ]
          .map(searchableText)
          .join(" ");

        if (/\b(search|query|keyword|q)\b/.test(text)) {
          return "search";
        }
        if (/\b(password|login|sign in|signin)\b/.test(text)) {
          return "login";
        }
        if (/\b(newsletter|subscribe)\b/.test(text)) {
          return "newsletter";
        }
        if (/\b(contact|message|comment|support)\b/.test(text)) {
          return "contact";
        }
        return "generic";
      };

      const formElements = Array.from(document.querySelectorAll("form"));

      const buttons = Array.from(document.querySelectorAll("button, input[type='button'], input[type='submit']"))
        .map((button) => {
          const rect = button.getBoundingClientRect();
          const visible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(button).visibility !== "hidden";
          const disabled = button.hasAttribute("disabled") || button.getAttribute("aria-disabled") === "true";
          const text = toText(button.textContent) || toText((button as HTMLInputElement).value);
          const parentForm = button.closest("form");

          return {
            text,
            label: text || toText(button.getAttribute("aria-label")) || toText(button.getAttribute("title")),
            type: button.getAttribute("type"),
            visible,
            disabled,
            formIndex: parentForm ? formElements.indexOf(parentForm) + 1 : null,
            selector: getSelector(button)
          };
        });

      const inputs = Array.from(document.querySelectorAll("input, textarea, select")).map((input) => {
        const id = input.getAttribute("id");
        const label = id ? document.querySelector(`label[for="${escapeAttributeValue(id)}"]`) : input.closest("label");
        const type = input.getAttribute("type");
        const normalizedType = (type ?? "text").toLowerCase();
        const rect = input.getBoundingClientRect();
        const visible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(input).visibility !== "hidden";
        const disabled = input.hasAttribute("disabled") || input.getAttribute("aria-disabled") === "true";
        const editable = visible && !disabled && !["hidden", "submit", "button", "reset", "image", "file"].includes(normalizedType);
        const parentForm = input.closest("form");
        return {
          type,
          name: input.getAttribute("name"),
          label:
            toText(label?.textContent) ||
            toText(input.getAttribute("aria-label")) ||
            toText(input.getAttribute("title")),
          required: input.hasAttribute("required"),
          placeholder: input.getAttribute("placeholder"),
          visible,
          disabled,
          editable,
          formIndex: parentForm ? formElements.indexOf(parentForm) + 1 : null,
          selector: getSelector(input)
        };
      });

      const forms = formElements.map((form, index) => {
        const formInputs = inputs.filter((input) => input.formIndex === index + 1);
        return {
          action: form.getAttribute("action"),
          method: form.getAttribute("method"),
          hasSubmitButton: Boolean(
            form.querySelector("button[type='submit'], input[type='submit']") ||
              form.querySelector("button:not([type]), input[type='search']")
          ),
          inputCount: formInputs.length,
          editableInputCount: formInputs.filter((input) => input.editable).length,
          requiredInputCount: formInputs.filter((input) => input.required && input.editable).length,
          kind: classifyForm(form),
          selector: getSelector(form)
        };
      });

      const images = Array.from(document.querySelectorAll("img")).map((image) => ({
        src: image.currentSrc || image.getAttribute("src") || "",
        alt: image.getAttribute("alt"),
        loaded: image.complete && image.naturalWidth > 0,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        selector: getSelector(image)
      }));

      const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).map((heading) =>
        toText(heading.textContent)
      );

      const landmarks = ["header", "nav", "main", "footer", "aside"]
        .filter((selector) => document.querySelector(selector))
        .map((selector) => selector);

      const scripts = document.querySelectorAll("script").length;
      const domNodeCount = document.querySelectorAll("*").length;
      const videos = Array.from(document.querySelectorAll("video")).map((video) => video.currentSrc || "");
      const iframes = Array.from(document.querySelectorAll("iframe")).map((frame) => frame.src || "");
      const textContent = toText(document.body?.innerText).replace(/\s+/g, " ");
      const resourceUrls = [
        ...Array.from(document.querySelectorAll("script[src]")).map((element) => (element as HTMLScriptElement).src),
        ...Array.from(document.querySelectorAll("link[href]")).map((element) => (element as HTMLLinkElement).href),
        ...Array.from(document.querySelectorAll("img[src]")).map((element) => (element as HTMLImageElement).src),
        ...Array.from(document.querySelectorAll("iframe[src]")).map((element) => (element as HTMLIFrameElement).src)
      ];
      const insecureFormActions = formElements
        .map((form) => {
          const rawAction = form.getAttribute("action") || window.location.href;
          let action = rawAction;
          try {
            action = new URL(rawAction, window.location.href).toString();
          } catch {
            action = rawAction;
          }

          return {
            action,
            selector: getSelector(form)
          };
        })
        .filter((form) => form.action.toLowerCase().startsWith("http://"));

      return {
        finalUrl: window.location.href,
        title: toText(document.title),
        description: toText(document.querySelector('meta[name="description"]')?.getAttribute("content")),
        lang: toText(document.documentElement.lang),
        headings,
        links,
        buttons,
        inputs,
        forms,
        images,
        videos,
        iframes,
        landmarks,
        textContent,
        domNodeCount,
        scriptCount: scripts,
        accessibilitySignals: {
          unlabeledInputs: inputs.filter((input) => !input.label).length,
          landmarksPresent: landmarks
        },
        securitySignals: {
          isHttps: window.location.protocol === "https:",
          mixedContentUrls: resourceUrls.filter((resourceUrl) => resourceUrl.toLowerCase().startsWith("http://")).slice(0, 20),
          insecureFormActions,
          passwordFieldsOnInsecurePage:
            window.location.protocol === "https:"
              ? 0
              : inputs.filter((input) => (input.type ?? "").toLowerCase() === "password").length
        }
      };
    }, url);

    const finalUrl = data.finalUrl;
    const scopedLinks = data.links.filter((link) => link.href.startsWith("http") && isSameHostname(finalUrl, link.href));
    const behaviorChecks = await runBehaviorChecks(page, url, data.forms, data.inputs, data.buttons, scopedLinks, behaviorConfig).catch(() => []);
    const pageScreenshot = await captureViewportScreenshot(page).catch(() => undefined);
    const screenshots = new Map<string, IssueScreenshot | undefined>();
    const getScreenshot = async (selector: string | undefined): Promise<IssueScreenshot | undefined> => {
      if (!selector) {
        return undefined;
      }

      if (!screenshots.has(selector)) {
        screenshots.set(selector, await captureElementScreenshot(page, selector).catch(() => undefined));
      }

      return screenshots.get(selector);
    };

    const links = await Promise.all(
      scopedLinks.map(async (link) => ({
        ...link,
        screenshot: !link.text ? await getScreenshot(link.selector) : undefined
      }))
    );
    const inputs = await Promise.all(
      data.inputs.map(async (input) => ({
        ...input,
        screenshot: !input.name || !input.label ? await getScreenshot(input.selector) : undefined
      }))
    );
    const forms = await Promise.all(
      data.forms.map(async (form) => ({
        ...form,
        screenshot: !form.hasSubmitButton ? await getScreenshot(form.selector) : undefined
      }))
    );
    const buttons = await Promise.all(
      data.buttons.map(async (button) => ({
        ...button,
        screenshot: button.visible && !button.disabled && !button.label ? await getScreenshot(button.selector) : undefined
      }))
    );
    const images = await Promise.all(
      data.images.map(async (image) => ({
        ...image,
        screenshot: image.alt === null || !image.loaded ? await getScreenshot(image.selector) : undefined
      }))
    );

    return {
      url,
      finalUrl,
      title: data.title,
      description: data.description,
      lang: data.lang,
      headings: data.headings,
      links,
      buttons,
      inputs,
      forms,
      images,
      videos: data.videos,
      iframes: data.iframes,
      landmarks: data.landmarks,
      textContent: data.textContent,
      domNodeCount: data.domNodeCount,
      scriptCount: data.scriptCount,
      consoleErrors,
      loadTimeMs: Date.now() - startTime,
      accessibilitySignals: data.accessibilitySignals,
      securitySignals: {
        ...data.securitySignals,
        responseHeaders
      },
      behaviorChecks,
      pageScreenshot
    };
  } finally {
    await page.close();
    await browser.close();
  }
}
