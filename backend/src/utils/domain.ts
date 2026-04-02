export function getHostname(input: string): string {
  return new URL(input).hostname.toLowerCase();
}

export function isSameHostname(left: string, right: string): boolean {
  return getHostname(left) === getHostname(right);
}

