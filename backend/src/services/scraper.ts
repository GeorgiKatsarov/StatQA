import { chromium } from "playwright";
import type { ScrapedData } from "../types/index.js";
import { isSameHostname } from "../utils/domain.js";

export async function scrapePage(url: string): Promise<ScrapedData> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const consoleErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  const startTime = Date.now();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    const data = await page.evaluate((currentUrl) => {
      const hostname = new URL(currentUrl).hostname;
      const toText = (value: string | null | undefined): string => (value ?? "").trim();

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
          isInternal
        };
      });

      const buttons = Array.from(document.querySelectorAll("button, input[type='button'], input[type='submit']"))
        .map((button) => ({
          text: toText(button.textContent) || toText((button as HTMLInputElement).value),
          type: button.getAttribute("type")
        }));

      const inputs = Array.from(document.querySelectorAll("input, textarea, select")).map((input) => {
        const id = input.getAttribute("id");
        const label = id ? document.querySelector(`label[for="${id}"]`) : input.closest("label");
        return {
          type: input.getAttribute("type"),
          name: input.getAttribute("name"),
          label: toText(label?.textContent),
          required: input.hasAttribute("required"),
          placeholder: input.getAttribute("placeholder")
        };
      });

      const forms = Array.from(document.querySelectorAll("form")).map((form) => ({
        action: form.getAttribute("action"),
        method: form.getAttribute("method"),
        hasSubmitButton: Boolean(form.querySelector("button[type='submit'], input[type='submit']"))
      }));

      const images = Array.from(document.querySelectorAll("img")).map((image) => ({
        src: image.currentSrc || image.getAttribute("src") || "",
        alt: image.getAttribute("alt")
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
        }
      };
    }, url);

    const finalUrl = data.finalUrl;
    const scopedLinks = data.links.filter((link) => link.href.startsWith("http") && isSameHostname(finalUrl, link.href));

    return {
      url,
      finalUrl,
      title: data.title,
      description: data.description,
      lang: data.lang,
      headings: data.headings,
      links: scopedLinks,
      buttons: data.buttons,
      inputs: data.inputs,
      forms: data.forms,
      images: data.images,
      videos: data.videos,
      iframes: data.iframes,
      landmarks: data.landmarks,
      textContent: data.textContent,
      domNodeCount: data.domNodeCount,
      scriptCount: data.scriptCount,
      consoleErrors,
      loadTimeMs: Date.now() - startTime,
      accessibilitySignals: data.accessibilitySignals
    };
  } finally {
    await page.close();
    await browser.close();
  }
}

