/**
 * Parses km from free-text training descriptions.
 * Recognizes: "8km", "10x400m", "2km + 6x1000m", standalone "1500m", etc.
 */
export function parseKmFromDescription(text) {
  if (!text || !text.trim()) return 0;
  const normalized = text.toLowerCase().replace(/,/g, '.');
  let totalKm = 0;
  const usedRanges = [];

  // Repetitions: "10x400m", "8 x 1000"
  const repRegex = /(\d+)\s*x\s*(\d+)\s*m?\b/g;
  let match;
  while ((match = repRegex.exec(normalized)) !== null) {
    const reps = parseInt(match[1]);
    const meters = parseInt(match[2]);
    if (reps > 0 && reps <= 100 && meters > 0 && meters <= 50000) {
      totalKm += (reps * meters) / 1000;
      usedRanges.push([match.index, match.index + match[0].length]);
    }
  }

  // Direct km: "8km", "8 km", "8k", "12.5km"
  const kmRegex = /(\d+(?:\.\d+)?)\s*k(?:m)?\b/g;
  while ((match = kmRegex.exec(normalized)) !== null) {
    const overlaps = usedRanges.some(([s, e]) => match.index >= s && match.index < e);
    if (!overlaps) {
      const km = parseFloat(match[1]);
      if (km > 0 && km <= 300) {
        totalKm += km;
        usedRanges.push([match.index, match.index + match[0].length]);
      }
    }
  }

  // Standalone meters: "1500m", "800m"
  const mRegex = /(?<!\dx?\s*)(\d+)\s*m\b/g;
  while ((match = mRegex.exec(normalized)) !== null) {
    const overlaps = usedRanges.some(([s, e]) => match.index >= s && match.index < e);
    if (!overlaps) {
      const meters = parseInt(match[1]);
      if (meters >= 200 && meters <= 50000) {
        totalKm += meters / 1000;
        usedRanges.push([match.index, match.index + match[0].length]);
      }
    }
  }

  return Math.round(totalKm * 10) / 10;
}
