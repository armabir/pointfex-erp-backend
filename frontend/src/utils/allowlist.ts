const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function parseAllowlistInput(
  rawText: string,
  existingPatterns: Set<string>,
): { toAdd: string[]; duplicates: number; invalid: string[] } {
  const tokens = rawText
    .split(/[\n,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  const seen = new Set<string>()
  const toAdd: string[] = []
  let duplicates = 0
  const invalid: string[] = []

  for (const token of tokens) {
    if (!EMAIL_REGEX.test(token)) {
      invalid.push(token)
      continue
    }
    if (seen.has(token) || existingPatterns.has(token)) {
      duplicates++
      continue
    }
    seen.add(token)
    toAdd.push(token)
  }
  return { toAdd, duplicates, invalid }
}

