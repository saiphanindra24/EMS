/**
 * Client-side utility to export structured tabular data to a CSV file.
 */

export interface ExportColumn<T> {
  header: string;
  accessor: keyof T | ((row: T) => string | number | boolean | null | undefined);
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }
  const str = String(value);
  // If the cell contains quotes, commas, or newlines, escape the quotes and wrap in quotes
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

export function exportToCsv<T>(
  filename: string,
  rows: T[],
  columns: ExportColumn<T>[],
) {
  if (!rows || rows.length === 0) {
    alert("No data available to export.");
    return;
  }

  // 1. Build CSV Header
  const headerRow = columns.map((col) => escapeCsvCell(col.header)).join(",");

  // 2. Build Data Rows
  const dataRows = rows.map((row) =>
    columns
      .map((col) => {
        const val =
          typeof col.accessor === "function"
            ? col.accessor(row)
            : row[col.accessor];
        return escapeCsvCell(val);
      })
      .join(","),
  );

  // 3. Combine into full CSV content
  const csvContent = [headerRow, ...dataRows].join("\r\n");

  // 4. Create Blob with UTF-8 BOM for Excel compatibility
  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  // 5. Trigger download
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  const cleanFilename = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  link.setAttribute("download", cleanFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
