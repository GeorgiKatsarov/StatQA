import { env } from "../config/env.js";
import { isSameHostname } from "../utils/domain.js";
import { normalizeUrl } from "../utils/normalizeUrl.js";

interface QueueItem {
  url: string;
  depth: number;
}

interface CrawlProgress {
  currentUrl: string;
  discovered: number;
  visited: number;
  queued: number;
}

type CrawlProgressReporter = (progress: CrawlProgress) => void;

interface CrawlLimits {
  maxPages: number;
  maxDepth: number;
}

function shouldSkipLink(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    return (
      /\.(jpg|jpeg|png|gif|svg|pdf|zip|webp|mp4|mp3|xml|json|css|js|woff2?|ttf|eot|ico)$/i.test(path) ||
      path.endsWith("/xmlrpc.php") ||
      path.includes("/wp-admin/") ||
      path.includes("/wp-json/") ||
      path.includes("/feed/")
    );
  } catch {
    return true;
  }
}

function extractLinks(html: string, baseUrl: string): string[] {
  const links = new Set<string>();
  const hrefPattern = /\bhref\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = hrefPattern.exec(html)) !== null) {
    const rawHref = match[1]?.trim();
    if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) {
      continue;
    }

    try {
      links.add(new URL(rawHref, baseUrl).toString());
    } catch {
      continue;
    }
  }

  return [...links];
}

async function fetchLinks(url: string): Promise<string[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "StatQA/0.1 website quality analyzer"
      }
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.includes("text/html")) {
      return [];
    }

    return extractLinks(await response.text(), response.url || url);
  } finally {
    clearTimeout(timeout);
  }
}

export async function crawlSite(
  startUrl: string,
  reportProgress?: CrawlProgressReporter,
  limits: CrawlLimits = { maxPages: env.MAX_PAGES, maxDepth: env.MAX_DEPTH }
): Promise<string[]> {
  const rootUrl = normalizeUrl(startUrl);
  const maxPages = Math.max(1, Math.min(limits.maxPages, env.MAX_PAGES));
  const maxDepth = Math.max(0, Math.min(limits.maxDepth, env.MAX_DEPTH));
  const visited = new Set<string>();
  const queued = new Set<string>([rootUrl]);
  const queue: QueueItem[] = [{ url: rootUrl, depth: 0 }];
  const results: string[] = [];

  while (queue.length > 0 && results.length < maxPages) {
    const current = queue.shift()!;
    if (visited.has(current.url)) {
      continue;
    }

    visited.add(current.url);
    results.push(current.url);
    reportProgress?.({
      currentUrl: current.url,
      discovered: results.length,
      visited: visited.size,
      queued: queue.length
    });

    if (current.depth >= maxDepth) {
      continue;
    }

    try {
      const links = await fetchLinks(current.url);
      for (const link of links) {
        if (!link.startsWith("http") || shouldSkipLink(link)) {
          continue;
        }

        const normalized = normalizeUrl(link);
        if (!isSameHostname(rootUrl, normalized) || visited.has(normalized) || queued.has(normalized)) {
          continue;
        }

        queue.push({ url: normalized, depth: current.depth + 1 });
        queued.add(normalized);

        if (queue.length + results.length >= maxPages) {
          break;
        }
      }
    } catch {
      continue;
    }
  }

  return results;
}
