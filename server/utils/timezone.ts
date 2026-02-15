/**
 * 시간대(KST) 처리 유틸리티
 * 
 * === 기본 정책 ===
 * - 서버 저장: UTC 기준 (Date 객체 그대로 저장)
 * - 앱/관리자 표시: KST (UTC+9) 기준으로 포맷팅
 * - 정산 기준일: 매월 1일 00:00 KST 기준
 * 
 * === 주의사항 ===
 * - Date 객체는 항상 UTC로 유지, 포맷팅 시에만 KST로 변환
 * - toKST/toUTC는 표시용 문자열 생성에만 사용
 */

/**
 * Date 객체를 KST 문자열로 포맷팅 (YYYY-MM-DD)
 */
export function formatDateKST(date: Date | string | number): string {
  const d = new Date(date);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(d);
}

/**
 * Date 객체를 KST 문자열로 포맷팅 (YYYY-MM-DD HH:mm:ss)
 */
export function formatDateTimeKST(date: Date | string | number): string {
  const d = new Date(date);
  const datePart = formatDateKST(d);
  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return `${datePart} ${timeFormatter.format(d)}`;
}

/**
 * 현재 KST 시각의 구성요소 반환 (표시용)
 */
export function getKSTComponents(date: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const kstString = date.toLocaleString('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  
  const [datePart, timePart] = kstString.split(', ');
  const [month, day, year] = datePart.split('/').map(Number);
  const [hour, minute, second] = timePart.split(':').map(Number);
  
  return { year, month, day, hour, minute, second };
}

/**
 * KST 기준 오늘 시작 시각 (00:00:00 KST) - UTC Date 반환
 */
export function todayStartKST(): Date {
  const { year, month, day } = getKSTComponents();
  const kstMidnight = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00+09:00`);
  return kstMidnight;
}

/**
 * KST 기준 오늘 종료 시각 (23:59:59 KST) - UTC Date 반환
 */
export function todayEndKST(): Date {
  const { year, month, day } = getKSTComponents();
  const kstEndOfDay = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T23:59:59.999+09:00`);
  return kstEndOfDay;
}

/**
 * KST 기준 특정 월의 시작일 (1일 00:00:00 KST) - UTC Date 반환
 */
export function monthStartKST(year: number, month: number): Date {
  return new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00+09:00`);
}

/**
 * KST 기준 특정 월의 종료일 (말일 23:59:59 KST) - UTC Date 반환
 */
export function monthEndKST(year: number, month: number): Date {
  const lastDay = new Date(year, month, 0).getDate();
  return new Date(`${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59.999+09:00`);
}

/**
 * 정산 기준 월 계산 (KST 기준)
 * - 1일~말일 작업 → 다음 달 정산
 */
export function getSettlementMonth(workDate: Date): { year: number; month: number } {
  const { year, month } = getKSTComponents(workDate);
  
  return month === 12 
    ? { year: year + 1, month: 1 }
    : { year, month: month + 1 };
}

/**
 * 두 날짜가 같은 날인지 확인 (KST 기준)
 */
export function isSameDayKST(date1: Date, date2: Date): boolean {
  return formatDateKST(date1) === formatDateKST(date2);
}

/**
 * 날짜가 오늘인지 확인 (KST 기준)
 */
export function isTodayKST(date: Date): boolean {
  return isSameDayKST(date, new Date());
}

/**
 * KST 기준 요일 반환 (0: 일, 1: 월, ..., 6: 토)
 */
export function getDayOfWeekKST(date: Date): number {
  const { year, month, day } = getKSTComponents(date);
  return new Date(year, month - 1, day).getDay();
}

/**
 * 시간대 정책 문서화를 위한 상수
 */
export const TIMEZONE_POLICY = {
  storage: "UTC",
  display: "KST (UTC+9)",
  settlementCutoff: "매월 1일 00:00 KST",
  workDayStart: "00:00 KST",
  workDayEnd: "23:59 KST",
  description: `
    === 시간대 처리 정책 ===
    
    1. 서버 저장: 모든 timestamp는 UTC로 저장 (Date 객체 그대로)
    2. 앱/관리자 표시: 한국 표준시(KST, UTC+9) 기준으로 포맷팅
    3. 정산 기준일: 매월 1일 00:00 KST 마감
    
    4. 근무일 정의:
       - 시작: 00:00 KST
       - 종료: 23:59 KST
    
    5. 주의사항:
       - Date 객체는 항상 UTC 유지
       - 표시용 문자열만 KST로 변환
       - API 응답은 ISO 8601 형식 (UTC)
       - 프론트엔드에서 KST로 표시 변환
  `,
};
