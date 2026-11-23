/**
 * RFC 4180-Compliant Universal CSV Export Utility
 * 
 * Supports UTF-8 BOM (\uFEFF) for proper rendering of Indian Rupee (₹) and multi-currency symbols
 * in Microsoft Excel, Apple Numbers, and Google Sheets.
 */

export function escapeCsvField(field: string | number | boolean | null | undefined): string {
  if (field === null || field === undefined) {
    return '';
  }
  const str = String(field);
  // If field contains comma, quote, or newline, escape internal quotes and wrap in quotes
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCsv(
  filename: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): void {
  // Ensure we are in a browser environment
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  // Prepend UTF-8 Byte Order Mark (BOM) so Excel respects UTF-8 (currency symbols like ₹)
  const BOM = '\uFEFF';

  // Format header row
  const headerLine = headers.map(escapeCsvField).join(',');

  // Format data rows
  const rowLines = rows.map((row) => row.map(escapeCsvField).join(','));

  const csvContent = BOM + [headerLine, ...rowLines].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const cleanFilename = filename.toLowerCase().endsWith('.csv') ? filename : `${filename}.csv`;

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', cleanFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default exportToCsv;
