/**
 * 관리자용 데이터베이스 뷰
 *
 * 여러 테이블의 조인을 미리 계산해서 성능 향상
 * 관리자 대시보드와 업무 대기함에서 사용
 */

import { pgView } from 'drizzle-orm/pg-core';
import { varchar, text, timestamp, boolean, integer, numeric } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * 관리자용 통합 오더 뷰
 *
 * 포함 정보:
 * - 오더 기본 정보 (상태, 일시, 금액)
 * - 요청자 정보 (이름, 회사, 연락처)
 * - 헬퍼 정보 (이름, 평점, 프로필)
 * - 결제 정보 (계약금, 잔금 여부)
 * - 정산 정보 (정산 ID, 상태, 금액)
 */
export const adminOrdersView = pgView('admin_orders_view', {
  id: integer('id').notNull(),
  status: text('status'),
  is_urgent: boolean('is_urgent'),
  created_at: timestamp('created_at'),
  status_updated_at: timestamp('status_updated_at'),
  approved_at: timestamp('approved_at'),

  // 요청자 정보
  requester_id: varchar('requester_id'),
  requester_name: text('requester_name'),
  requester_company: text('requester_company'),
  requester_email: text('requester_email'),
  requester_phone: text('requester_phone'),
  requester_avatar: text('requester_avatar'),

  // 헬퍼 정보
  helper_id: varchar('helper_id'),
  helper_name: text('helper_name'),
  helper_rating: numeric('helper_rating'),
  helper_avatar: text('helper_avatar'),
  helper_phone: text('helper_phone'),

  // 구간 정보
  pickup: text('pickup'),
  delivery: text('delivery'),
  pickup_time: timestamp('pickup_time'),

  // 금액 정보
  total_amount: numeric('total_amount'),
  deposit_paid: boolean('deposit_paid'),
  balance_paid: boolean('balance_paid'),
  deposit_paid_at: timestamp('deposit_paid_at'),
  balance_paid_at: timestamp('balance_paid_at'),

  // 정산 정보
  settlement_id: integer('settlement_id'),
  settlement_status: text('settlement_status'),
  settlement_amount: numeric('settlement_amount'),
  platform_fee: numeric('platform_fee'),
  settlement_submitted_at: timestamp('settlement_submitted_at'),

  // 플랫폼 수익
  platform_revenue: numeric('platform_revenue'),

  // 대기 시간 (분)
  status_waiting_minutes: numeric('status_waiting_minutes'),
}).existing();

/**
 * 작업 대기함 뷰
 *
 * 관리자가 처리해야 할 작업들을 자동으로 수집:
 * 1. 오더 승인 대기 (status = 'pending')
 * 2. 정산 승인 대기 (settlement status = 'pending')
 * 3. 헬퍼 인증 대기 (identity_verifications status = 'submitted')
 * 4. 결제 확인 필요 (특수 케이스)
 *
 * 우선순위:
 * - 1순위: 긴급 오더
 * - 2순위: 고액 정산 (50만원 이상)
 * - 3순위: 일반
 */
export const taskQueueView = pgView('task_queue_view', {
  task_type: text('task_type').notNull(),
  reference_id: integer('reference_id').notNull(),
  priority: integer('priority'),
  waiting_minutes: numeric('waiting_minutes'),
  related_data: text('related_data'), // JSON string
}).existing();

/**
 * 실시간 통계 뷰
 *
 * 관리자 대시보드의 주요 지표:
 * - 진행 중 오더 수
 * - 활성 헬퍼 수
 * - 승인 대기 정산 총액
 * - 오늘의 플랫폼 수익
 */
export const adminStatsView = pgView('admin_stats_view', {
  active_orders: integer('active_orders'),
  active_helpers: integer('active_helpers'),
  pending_settlement_total: numeric('pending_settlement_total'),
  today_revenue: numeric('today_revenue'),
  this_month_revenue: numeric('this_month_revenue'),
  today_completed_orders: integer('today_completed_orders'),
  this_month_completed_orders: integer('this_month_completed_orders'),
}).existing();

/**
 * 헬퍼별 정산 요약 뷰
 *
 * 헬퍼의 정산 현황을 빠르게 조회:
 * - 총 수익
 * - 지급 대기 금액
 * - 지급 완료 금액
 * - 평균 정산 금액
 */
export const helperSettlementSummaryView = pgView('helper_settlement_summary_view', {
  helper_id: varchar('helper_id').notNull(),
  helper_name: text('helper_name'),
  helper_email: text('helper_email'),
  helper_phone: text('helper_phone'),
  total_settlements: integer('total_settlements'),
  total_earnings: numeric('total_earnings'),
  pending_amount: numeric('pending_amount'),
  approved_amount: numeric('approved_amount'),
  paid_amount: numeric('paid_amount'),
  avg_settlement: numeric('avg_settlement'),
  last_settlement_date: timestamp('last_settlement_date'),
  next_payout_date: timestamp('next_payout_date'),
}).existing();

/**
 * 요청자별 청구 요약 뷰
 *
 * 요청자의 결제 현황:
 * - 총 오더 수
 * - 총 청구액
 * - 미결제액
 * - 결제 완료액
 */
export const requesterBillingSummaryView = pgView('requester_billing_summary_view', {
  requester_id: varchar('requester_id').notNull(),
  requester_name: text('requester_name'),
  requester_company: text('requester_company'),
  requester_email: text('requester_email'),
  requester_phone: text('requester_phone'),
  total_orders: integer('total_orders'),
  active_orders: integer('active_orders'),
  total_billed: numeric('total_billed'),
  unpaid_deposit: numeric('unpaid_deposit'),
  unpaid_balance: numeric('unpaid_balance'),
  total_paid: numeric('total_paid'),
  last_order_date: timestamp('last_order_date'),
}).existing();
