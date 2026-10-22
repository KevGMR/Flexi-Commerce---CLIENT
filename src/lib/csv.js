// client/src/lib/csv.js
//
// Minimal CSV helpers. Handles commas, quotes, and newlines in cell values.
// Not a library — just enough to produce Excel-safe output.

function escapeCell(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Build a CSV string from a headers array and rows array.
 *
 *   buildCSV({ headers: ["Name", "Total"], rows: [["Alice", 42], ["Bob", 7]] })
 *
 * rows can be arrays (aligned with headers) or objects keyed by header.
 */
export function buildCSV({ headers, rows }) {
  const head = headers.map(escapeCell).join(",");
  const body = rows
    .map((row) => {
      if (Array.isArray(row)) {
        return row.map(escapeCell).join(",");
      }
      return headers.map((h) => escapeCell(row[h])).join(",");
    })
    .join("\n");
  return head + "\n" + body + "\n";
}

/**
 * Trigger a browser download of a CSV string.
 */
export function downloadCSV(filename, csvString) {
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Convenience: build and download in one call.
 */
export function exportCSV({ filename, headers, rows }) {
  const csv = buildCSV({ headers, rows });
  downloadCSV(filename, csv);
}