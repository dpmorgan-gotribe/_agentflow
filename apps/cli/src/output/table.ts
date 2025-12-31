/**
 * Table Formatter
 *
 * Simple table formatting for CLI output.
 */

/**
 * Table column definition
 */
export interface TableColumn {
  key: string;
  header: string;
  width?: number;
  align?: 'left' | 'right' | 'center';
}

/**
 * Format data as a table
 */
export function formatTable(
  rows: Record<string, unknown>[],
  columns?: TableColumn[]
): string {
  if (rows.length === 0) {
    return 'No data';
  }

  // Auto-detect columns if not provided
  const cols: TableColumn[] = columns || Object.keys(rows[0] || {}).map((key) => ({
    key,
    header: key,
  }));

  // Calculate column widths
  const widths: Record<string, number> = {};
  for (const col of cols) {
    const headerWidth = col.header.length;
    const maxDataWidth = Math.max(
      ...rows.map((row) => String(row[col.key] ?? '').length)
    );
    widths[col.key] = col.width || Math.max(headerWidth, maxDataWidth);
  }

  // Build header row
  const header = cols
    .map((col) => padString(col.header, widths[col.key] ?? 0, col.align))
    .join(' | ');

  // Build separator
  const separator = cols
    .map((col) => '-'.repeat(widths[col.key] ?? 0))
    .join('-+-');

  // Build data rows
  const dataRows = rows.map((row) =>
    cols
      .map((col) =>
        padString(String(row[col.key] ?? ''), widths[col.key] ?? 0, col.align)
      )
      .join(' | ')
  );

  return [header, separator, ...dataRows].join('\n');
}

/**
 * Pad a string to a specific width
 */
function padString(
  str: string,
  width: number,
  align: 'left' | 'right' | 'center' = 'left'
): string {
  const diff = width - str.length;
  if (diff <= 0) {
    return str.slice(0, width);
  }

  switch (align) {
    case 'right':
      return ' '.repeat(diff) + str;
    case 'center': {
      const left = Math.floor(diff / 2);
      const right = diff - left;
      return ' '.repeat(left) + str + ' '.repeat(right);
    }
    case 'left':
    default:
      return str + ' '.repeat(diff);
  }
}

/**
 * Truncate a string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Format a key-value list
 */
export function formatKeyValue(
  data: Record<string, unknown>,
  keyWidth: number = 12
): string {
  return Object.entries(data)
    .map(([key, value]) => {
      const paddedKey = key.padEnd(keyWidth);
      return `${paddedKey} ${value}`;
    })
    .join('\n');
}
