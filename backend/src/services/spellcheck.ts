export function findBasicSpellingSignals(text: string): string[] {
  const normalized = text.toLowerCase();
  const matches: string[] = [];

  if (normalized.includes("lorem ipsum")) {
    matches.push("Found lorem ipsum placeholder text.");
  }

  if (normalized.includes("todo")) {
    matches.push("Found TODO placeholder text.");
  }

  return matches;
}

