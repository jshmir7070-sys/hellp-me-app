/**
 * 대량 액션 보호 장치 (T-31)
 * 
 * 관리자 일괄 처리 기능의 대규모 사고 방지:
 * - 최대 처리 건수 제한
 * - 사전 미리보기 (영향 금액/건수)
 * - 2단계 확인 (프론트엔드와 연동)
 */

export const BULK_ACTION_LIMITS = {
  MAX_ITEMS_PER_BATCH: 50,
  MAX_AMOUNT_PER_BATCH: 50000000, // 5천만원
  REQUIRE_CONFIRMATION_ABOVE: 10,
  REQUIRE_2FA_ABOVE_AMOUNT: 10000000, // 1천만원
} as const;

export interface BulkActionPreview {
  itemCount: number;
  totalAmount: number;
  affectedUsers: number;
  estimatedDuration: string;
  warnings: string[];
  requiresConfirmation: boolean;
  requires2FA: boolean;
}

export interface BulkActionValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 대량 액션 유효성 검사
 */
export function validateBulkAction(
  itemCount: number,
  totalAmount: number
): BulkActionValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (itemCount > BULK_ACTION_LIMITS.MAX_ITEMS_PER_BATCH) {
    errors.push(`최대 ${BULK_ACTION_LIMITS.MAX_ITEMS_PER_BATCH}건까지만 처리할 수 있습니다 (현재: ${itemCount}건)`);
  }
  
  if (totalAmount > BULK_ACTION_LIMITS.MAX_AMOUNT_PER_BATCH) {
    errors.push(`일괄 처리 금액이 한도를 초과했습니다 (한도: ${(BULK_ACTION_LIMITS.MAX_AMOUNT_PER_BATCH / 10000).toLocaleString()}만원)`);
  }
  
  if (itemCount > BULK_ACTION_LIMITS.REQUIRE_CONFIRMATION_ABOVE) {
    warnings.push(`${itemCount}건의 대량 처리입니다. 신중하게 확인해주세요.`);
  }
  
  if (totalAmount > BULK_ACTION_LIMITS.REQUIRE_2FA_ABOVE_AMOUNT) {
    warnings.push(`${(totalAmount / 10000).toLocaleString()}만원 규모의 처리입니다. 추가 인증이 필요합니다.`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 대량 액션 미리보기 생성
 */
export function generateBulkActionPreview(
  items: Array<{ amount?: number; userId?: string }>,
  actionType: string
): BulkActionPreview {
  const itemCount = items.length;
  const totalAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0);
  const affectedUsers = new Set(items.map(i => i.userId).filter(Boolean)).size;
  
  const estimatedSeconds = Math.ceil(itemCount * 0.5);
  const estimatedDuration = estimatedSeconds < 60 
    ? `약 ${estimatedSeconds}초`
    : `약 ${Math.ceil(estimatedSeconds / 60)}분`;
  
  const warnings: string[] = [];
  
  if (itemCount > 20) {
    warnings.push("대량 처리 중 일부 실패 시 롤백되지 않습니다.");
  }
  
  if (totalAmount > 10000000) {
    warnings.push("고액 처리입니다. 재무팀 승인이 필요할 수 있습니다.");
  }
  
  return {
    itemCount,
    totalAmount,
    affectedUsers,
    estimatedDuration,
    warnings,
    requiresConfirmation: itemCount > BULK_ACTION_LIMITS.REQUIRE_CONFIRMATION_ABOVE,
    requires2FA: totalAmount > BULK_ACTION_LIMITS.REQUIRE_2FA_ABOVE_AMOUNT,
  };
}

/**
 * 대량 액션 실행 제한 확인
 */
export function canExecuteBulkAction(
  preview: BulkActionPreview,
  hasConfirmation: boolean,
  has2FA: boolean
): { allowed: boolean; reason?: string } {
  if (preview.requiresConfirmation && !hasConfirmation) {
    return { allowed: false, reason: "대량 처리 확인이 필요합니다" };
  }
  
  if (preview.requires2FA && !has2FA) {
    return { allowed: false, reason: "추가 인증이 필요합니다" };
  }
  
  const validation = validateBulkAction(preview.itemCount, preview.totalAmount);
  if (!validation.isValid) {
    return { allowed: false, reason: validation.errors[0] };
  }
  
  return { allowed: true };
}
