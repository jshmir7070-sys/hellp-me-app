
export const DISPUTE_TYPE_LABELS: Record<string, string> = {
    settlement_error: "정산오류",
    invoice_error: "세금계산서 오류",
    closing_data_mismatch: "마감자료불일치",
    contract_dispute: "계약조건분쟁",
    service_complaint: "서비스불만",
    delay: "일정관련",
    no_show: "노쇼",
    count_mismatch: "수량 불일치",
    amount_error: "금액 오류",
    freight_accident: "화물 사고",
    damage: "물품 파손",
    delivery_issue: "배송 문제",
    other: "기타",
};

export const DISPUTE_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: "대기중", color: "#F59E0B", bg: "#FEF3C7" },
    reviewing: { label: "검토중", color: "#3B82F6", bg: "#DBEAFE" },
    resolved: { label: "완료", color: "#10B981", bg: "#D1FAE5" },
    rejected: { label: "반려", color: "#EF4444", bg: "#FEE2E2" },
};

// 상호 호환성을 위한 알리아스 (기존 코드 지원)
export const STATUS_CONFIG = DISPUTE_STATUS_CONFIG;
