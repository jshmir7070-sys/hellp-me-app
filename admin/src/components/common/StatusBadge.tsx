import { cn } from '@/lib/utils';

type StatusType = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface StatusBadgeProps {
  status: string;
  type?: StatusType;
  className?: string;
}

const statusTypeMap: Record<string, StatusType> = {
  // 표준 오더 상태머신 (앱과 동일)
  awaiting_deposit: 'warning',
  open: 'info',
  matching: 'warning',
  scheduled: 'info',
  in_progress: 'success',
  closing_submitted: 'warning',
  final_amount_confirmed: 'success',
  balance_paid: 'success',
  settlement_paid: 'success',
  closed: 'neutral',
  cancelled: 'error',

  // 레거시/대문자 상태
  OPEN: 'info',
  APPLYING_CLOSED: 'warning',
  HELPER_SELECTED: 'info',
  DEPOSIT_REQUESTED: 'warning',
  SCHEDULED: 'info',
  IN_PROGRESS: 'warning',
  CLOSING_SUBMITTED: 'warning',
  FINAL_CONFIRMED: 'success',
  BALANCE_PAID: 'success',
  SETTLED: 'success',
  
  // 레거시/기타 상태
  DRAFT: 'neutral',
  MATCHED: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'error',
  EXPIRED: 'error',
  CREATED: 'neutral',
  SIGNED: 'info',
  ACTIVE: 'success',
  CLOSED: 'neutral',
  VOID: 'error',
  DISPUTED: 'error',
  REQUESTED: 'neutral',
  PENDING: 'warning',
  PAID: 'success',
  CONFIRMED: 'success',
  REFUNDED: 'warning',
  REVERSED: 'error',
  FAILED: 'error',
  WEBHOOK_MISSING: 'error',
  
  // 정산 상태
  CALCULATED: 'neutral',
  HOLD: 'warning',
  APPROVED: 'info',
  PAID_OUT: 'success',
  ADJUSTED: 'warning',
  PAYABLE: 'info',
  
  // 증빙 상태
  UPLOADED: 'neutral',
  REVIEWED_APPROVED: 'success',
  REVIEWED_REJECTED: 'error',
  
  // 소문자 레거시
  registered: 'info',
  matched: 'warning',
  working: 'warning',
  completed: 'success',
  approved: 'success',
  rejected: 'error',
  pending: 'warning',
  active: 'success',
  signed: 'info',
  
  // 분쟁/CS
  NEW: 'info',
  IN_REVIEW: 'warning',
  RESOLVED: 'success',
};

const statusLabelMap: Record<string, string> = {
  // 표준 오더 상태머신 (앱과 동일)
  awaiting_deposit: '승인대기',
  open: '등록중',
  matching: '매칭중',
  scheduled: '예정',
  in_progress: '업무중',
  closing_submitted: '마감제출',
  final_amount_confirmed: '최종확정',
  balance_paid: '잔금완료',
  settlement_paid: '정산완료',
  closed: '종료',
  cancelled: '취소',

  // 레거시/대문자 상태
  OPEN: '모집중',
  APPLYING_CLOSED: '지원마감',
  HELPER_SELECTED: '헬퍼선정',
  DEPOSIT_REQUESTED: '계약금대기',
  SCHEDULED: '예정',
  IN_PROGRESS: '진행중',
  CLOSING_SUBMITTED: '마감대기',
  FINAL_CONFIRMED: '최종확정',
  BALANCE_PAID: '잔금완료',
  SETTLED: '정산완료',
  
  // 레거시/기타 상태
  DRAFT: '임시',
  MATCHED: '매칭완료',
  COMPLETED: '완료',
  CANCELLED: '취소',
  EXPIRED: '만료',
  CREATED: '생성됨',
  SIGNED: '서명완료',
  ACTIVE: '진행중',
  CLOSED: '종료',
  VOID: '무효',
  DISPUTED: '분쟁중',
  REQUESTED: '요청됨',
  PENDING: '대기중',
  PAID: '결제완료',
  CONFIRMED: '확정',
  REFUNDED: '환불됨',
  REVERSED: '취소됨',
  FAILED: '실패',
  WEBHOOK_MISSING: '웹훅미수신',
  
  // 정산 상태
  CALCULATED: '산출됨',
  HOLD: '보류',
  APPROVED: '확정',
  PAID_OUT: '지급완료',
  ADJUSTED: '조정됨',
  PAYABLE: '지급대기',
  
  // 증빙 상태
  UPLOADED: '업로드됨',
  REVIEWED_APPROVED: '승인됨',
  REVIEWED_REJECTED: '반려됨',
  
  // 소문자 레거시
  registered: '등록중',
  matched: '매칭됨',
  working: '업무중',
  completed: '완료',
  approved: '승인됨',
  rejected: '반려됨',
  pending: '대기중',
  active: '활성',
  signed: '서명완료',
  
  // 분쟁/CS
  NEW: '신규',
  IN_REVIEW: '검토중',
  RESOLVED: '해결됨',
};

const typeStyles: Record<StatusType, string> = {
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  neutral: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
};

export function StatusBadge({ status, type, className }: StatusBadgeProps) {
  const resolvedType = type || statusTypeMap[status] || 'neutral';
  const label = statusLabelMap[status] || status;

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        typeStyles[resolvedType],
        className
      )}
    >
      {label}
    </span>
  );
}
