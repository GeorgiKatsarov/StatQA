import { env } from "../config/env.js";
import { isSameHostname } from "../utils/domain.js";
import { normalizeUrl } from "../utils/normalizeUrl.js";
import { scrapePage } from "./scraper.js";

interface QueueItem {
  url: string;
  depth: number;
}

function shouldSkipLink(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|svg|pdf|zip|webp|mp4|mp3)$/i.test(url);
}

export async function crawlSite(startUrl: string): Promise<string[]> {
  const rootUrl = normalizeUrl(startUrl);
  const visited = new Set<string>();
  const queued = new Set<string>([rootUrl]);
  const queue: QueueItem[] = [{ url: rootUrl, depth: 0 }];
  const results: string[] = [];

  while (queue.length > 0 && results.length < env.MAX_PAGES) {
    const current = queue.shift()!;
    if (visited.has(current.url)) {
      continue;
    }

    visited.add(current.url);
    results.push(current.url);

    if (current.depth >= env.MAX_DEPTH) {
      continue;
    }

    try {
      const scraped = await scrapePage(current.url);
      for (const link of scraped.links) {
        if (!link.href.startsWith("http") || shouldSkipLink(link.href)) {
          continue;
        }

        const normalized = normalizeUrl(link.href);
        if (!isSameHostname(rootUrl, normalized) || visited.has(normalized) || queued.has(normalized)) {
          continue;
        }

        queue.push({ url: normalized, depth: current.depth + 1 });
        queued.add(normalized);

        if (queue.length + results.length >= env.MAX_PAGES) {
          break;
        }
      }
    } catch {
      continue;
    }
  }

  return results;
}

