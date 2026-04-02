const blockedHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const privateIpv4Patterns = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./
];

export function assertSafePublicUrl(input: string): void {
  const url = new URL(input);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only http and https URLs are supported.");
  }

  const hostname = url.hostname.toLowerCase();
  if (blockedHosts.has(hostname)) {
    throw new Error("Localhost targets are not allowed.");
  }

  if (privateIpv4Patterns.some((pattern) => pattern.test(hostname))) {
    throw new Error("Private network targets are not allowed.");
  }
}

