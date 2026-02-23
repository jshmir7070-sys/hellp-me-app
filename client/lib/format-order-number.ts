/**
 * 12자리 오더번호 포맷팅 유틸리티
 *
 * DB 저장 형식: "100212340001" (12자리 숫자)
 * 표시 형식:    "1-002-1234-0001" (대시 구분)
 *
 * @param orderNumber DB의 orderNumber (12자리 숫자 문자열)
 * @param fallbackId orderId (orderNumber가 없을 때 fallback)
 * @returns 포맷된 오더번호 문자열
 */
export function formatOrderNumber(
  orderNumber?: string | null,
  fallbackId?: string | number | null
): string {
  if (orderNumber && orderNumber.length === 12) {
    return `${orderNumber[0]}-${orderNumber.slice(1, 4)}-${orderNumber.slice(4, 8)}-${orderNumber.slice(8, 12)}`;
  }
  if (orderNumber) return orderNumber;
  if (fallbackId != null) return `#${fallbackId}`;
  return "-";
}
