export function normalizeUrl(input: string): string {
  const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  const url = new URL(withProtocol);

  url.hash = "";
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
    url.port = "";
  }

  const pathname = url.pathname === "/" ? "/" : url.pathname.replace(/\/+$/, "");
  url.pathname = pathname || "/";

  return url.toString();
}

