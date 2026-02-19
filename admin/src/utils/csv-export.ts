/**
 * CSV 셀 값 이스케이프
 * - 콤마, 줄바꿈, 따옴표가 포함된 값을 안전하게 처리
 */
function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * 데이터 배열을 CSV 문자열로 변환
 */
export function toCSV<T extends Record<string, unknown>>(
  data: T[],
  headers?: string[],
): string {
  if (data.length === 0) return '';
  const keys = headers || Object.keys(data[0]);
  const headerRow = keys.map(escapeCell).join(',');
  const rows = data.map((row) =>
    keys.map((key) => escapeCell(row[key])).join(','),
  );
  return [headerRow, ...rows].join('\n');
}

/**
 * CSV 파일 다운로드
 */
export function downloadCSV(
  data: Record<string, unknown>[],
  filename: string,
  headers?: string[],
): void {
  const csv = toCSV(data, headers);
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
