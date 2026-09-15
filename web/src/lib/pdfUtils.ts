// ============================================================================
// Client-Side PDF Page Count Inspector
// Extracts total page count from raw PDF bytes without bulky external libraries
// ============================================================================

export async function getPdfPageCount(file: File): Promise<number> {
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const text = new TextDecoder("latin1").decode(bytes);

    // Look for /Count in /Pages dictionary
    // e.g. /Type /Pages ... /Count 12
    const countMatches = text.match(/\/Type\s*\/Pages[^>]*\/Count\s+(\d+)/);
    if (countMatches && countMatches[1]) {
      const parsed = parseInt(countMatches[1], 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }

    // Secondary heuristic: match all /Type /Page (individual page objects)
    // Avoid false positives from /Type /Pages
    const pageMatches = text.match(/\/Type\s*\/Page\b/g);
    if (pageMatches && pageMatches.length > 0) {
      return pageMatches.length;
    }

    // Tertiary heuristic: match /Page\b followed by <<
    const fallbackMatches = text.match(/\/Page\s*<<\s*\/Parent/g);
    if (fallbackMatches && fallbackMatches.length > 0) {
      return fallbackMatches.length;
    }

    return 1;
  } catch (err) {
    console.warn("Could not parse PDF page count, defaulting to 1", err);
    return 1;
  }
}
