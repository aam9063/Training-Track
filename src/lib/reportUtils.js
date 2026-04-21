// Defensive re-parse helpers for AI-generated reports (client-side fallback).
// If the server accidentally returned a raw JSON/markdown string (e.g. because
// the AI response parser fell back to a text section containing
// ```json ... ```), we try to recover a proper `{ sections: [...] }` object
// here so the user does not see raw markdown fences.

export function stripMarkdownFences(input) {
  if (typeof input !== 'string') return input;
  let s = input.trim();
  s = s.replace(/^```(?:json|JSON)?\s*\n?/i, '');
  s = s.replace(/\n?```\s*$/i, '');
  // Remove any leftover triple-backticks so they never render as literal text.
  s = s.replace(/```/g, '');
  return s.trim();
}

export function extractBalancedJson(input) {
  if (typeof input !== 'string') return null;
  const openers = { '{': '}', '[': ']' };
  let start = -1;
  let openChar = '';
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '{' || ch === '[') {
      start = i;
      openChar = ch;
      break;
    }
  }
  if (start === -1) return null;
  const closeChar = openers[openChar];
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < input.length; i++) {
    const ch = input[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === openChar) depth += 1;
    else if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) return input.slice(start, i + 1);
    }
  }
  return null;
}

export function tryRecoverReport(value) {
  if (!value) return null;
  // Case A: report arrived as a plain string.
  if (typeof value === 'string') {
    const stripped = stripMarkdownFences(value);
    try {
      const parsed = JSON.parse(stripped);
      if (parsed && Array.isArray(parsed.sections)) return parsed;
    } catch {
      // fall through
    }
    const balanced = extractBalancedJson(stripped);
    if (balanced) {
      try {
        const parsed = JSON.parse(balanced);
        if (parsed && Array.isArray(parsed.sections)) return parsed;
      } catch {
        // fall through
      }
    }
    // Last resort: show cleaned text without markdown fences.
    return { sections: [{ type: 'text', content: stripped }] };
  }
  // Case B: report is an object with a single text section containing raw JSON.
  if (typeof value === 'object' && Array.isArray(value.sections)) {
    const first = value.sections[0];
    if (
      value.sections.length <= 2 &&
      first &&
      first.type === 'text' &&
      typeof first.content === 'string' &&
      /^\s*```(?:json)?/i.test(first.content)
    ) {
      const stripped = stripMarkdownFences(first.content);
      const balanced = extractBalancedJson(stripped) ?? stripped;
      try {
        const parsed = JSON.parse(balanced);
        if (parsed && Array.isArray(parsed.sections)) return parsed;
      } catch {
        // Return the sections with fences removed from the text so the user
        // at least sees clean content instead of raw markdown.
        return {
          sections: value.sections.map((s) =>
            s && s.type === 'text' && typeof s.content === 'string'
              ? { ...s, content: stripMarkdownFences(s.content) }
              : s,
          ),
        };
      }
    }
    // Scan every text section (any index) looking for raw JSON or fenced JSON
    // that should be expanded into proper sections.
    for (let i = 0; i < value.sections.length; i++) {
      const s = value.sections[i];
      if (
        s &&
        s.type === 'text' &&
        typeof s.content === 'string' &&
        /^\s*(```|\{\s*"|\[\s*\{)/.test(s.content)
      ) {
        const stripped = stripMarkdownFences(s.content);
        const balanced = extractBalancedJson(stripped) ?? stripped;
        try {
          const parsed = JSON.parse(balanced);
          if (parsed && Array.isArray(parsed.sections)) return parsed;
        } catch {
          // continue scanning the rest
        }
      }
    }
  }
  return null;
}
