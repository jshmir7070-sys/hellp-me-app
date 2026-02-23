/**
 * 12자리 오더번호 생성 유틸리티
 *
 * 구조:
 * - 개인요청자 (앞자리 1): 1 + 지역번호3자리 + 요청자폰뒷4자리 + 순번4자리
 * - 본사/협력업체 (앞자리 2): 2 + 지역번호3자리 + 담당자폰뒷4자리 + 순번4자리
 *
 * 예시: 1-002-1234-0001 (개인, 서울, 폰뒷자리1234, 첫번째)
 */

import { db } from "../db";
import { orders } from "../../shared/schema";
import { sql } from "drizzle-orm";

// 지역번호 매핑 (배송지역 텍스트 → 3자리 코드)
const AREA_CODE_MAP: Record<string, string> = {
  '서울': '002',
  '경기': '031',
  '인천': '032',
  '강원': '033',
  '충남': '041',
  '대전': '042',
  '충북': '043',
  '세종': '044',
  '부산': '051',
  '울산': '052',
  '대구': '053',
  '경북': '054',
  '경남': '055',
  '전남': '061',
  '광주': '062',
  '전북': '063',
  '제주': '064',
};

/**
 * 배송지역 텍스트에서 3자리 지역코드 추출
 * @param deliveryArea 배송지역 텍스트 (예: "서울시 강남구 역삼동")
 * @returns 3자리 지역코드 (예: "002")
 */
function getAreaCode(deliveryArea: string): string {
  for (const [region, code] of Object.entries(AREA_CODE_MAP)) {
    if (deliveryArea.includes(region)) return code;
  }
  return '000'; // 기타/불명
}

/**
 * 전화번호에서 뒤 4자리 추출
 * @param phone 전화번호 문자열
 * @returns 4자리 숫자 문자열
 */
function getPhoneLast4(phone: string | null | undefined): string {
  if (!phone) return '0000';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return digits.padStart(4, '0');
  return digits.slice(-4);
}

/**
 * 동일 prefix(앞8자리)에서 다음 순번(4자리) 가져오기
 * @param prefix 앞 8자리 (타입1 + 지역3 + 폰4)
 * @returns 4자리 순번 문자열 (예: "0001")
 */
async function getNextSequence(prefix: string): Promise<string> {
  // DB에서 같은 prefix로 시작하는 orderNumber 중 최대 순번 조회
  const result = await db.select({
    maxSeq: sql<string>`MAX(SUBSTRING(order_number FROM 9 FOR 4))`,
  }).from(orders)
    .where(sql`order_number LIKE ${prefix + '%'}`);

  const currentMax = result[0]?.maxSeq;
  let nextSeq = 1;

  if (currentMax) {
    nextSeq = parseInt(currentMax, 10) + 1;
  }

  if (nextSeq > 9999) {
    throw new Error(`오더번호 순번 초과: prefix=${prefix}, 최대 9999건까지 가능`);
  }

  return nextSeq.toString().padStart(4, '0');
}

export interface GenerateOrderNumberParams {
  isEnterprise: boolean;        // 본사/협력업체 오더 여부
  deliveryArea: string;         // 배송지역 텍스트
  requesterPhone?: string | null;      // 개인요청자 전화번호
  enterpriseContactPhone?: string | null; // 협력업체 담당자 전화번호
}

/**
 * 12자리 오더번호 생성
 * @returns 12자리 숫자 문자열 (예: "100212340001")
 */
export async function generateOrderNumber(params: GenerateOrderNumberParams): Promise<string> {
  const typePrefix = params.isEnterprise ? '2' : '1';
  const areaCode = getAreaCode(params.deliveryArea);
  const phoneLast4 = params.isEnterprise
    ? getPhoneLast4(params.enterpriseContactPhone)
    : getPhoneLast4(params.requesterPhone);

  const prefix = `${typePrefix}${areaCode}${phoneLast4}`;
  const seq = await getNextSequence(prefix);

  return `${prefix}${seq}`;
}
