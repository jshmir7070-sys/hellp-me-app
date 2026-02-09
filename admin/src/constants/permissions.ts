/**
 * 관리자 권한 및 메뉴 액션 키 표준화
 *
 * 네이밍 규칙:
 * - 메뉴 그룹: MENU_{카테고리}
 * - 액션: {모듈}.{액션}
 * - 액션 타입: view, create, update, delete, manage, approve
 */

// ===== 메뉴 그룹 키 =====
export const MENU_KEYS = {
  // 운영
  DASHBOARD: 'menu.dashboard',
  TASK_QUEUE: 'menu.taskQueue',

  // 오더 운영
  ORDERS: 'menu.orders',

  // 결제 및 환불
  PAYMENTS: 'menu.payments',

  // 정산
  SETTLEMENTS: 'menu.settlements',

  // 헬퍼 관리
  HELPERS: 'menu.helpers',

  // 요청자 관리
  REQUESTERS: 'menu.requesters',

  // 운임/정책
  RATES: 'menu.rates',

  // 이의제기/사고
  DISPUTES: 'menu.disputes',

  // CS
  CS: 'menu.cs',

  // 설정
  SETTINGS: 'menu.settings',
} as const;

// ===== 액션 권한 키 (표준화) =====
export const PERMISSIONS = {
  // 대시보드 & 업무 대기함
  DASHBOARD_VIEW: 'dashboard.view',
  TASK_QUEUE_VIEW: 'taskQueue.view',
  TASK_QUEUE_MANAGE: 'taskQueue.manage',

  // 오더 관련
  ORDERS_VIEW: 'orders.view',
  ORDERS_CREATE: 'orders.create',
  ORDERS_UPDATE: 'orders.update',
  ORDERS_DELETE: 'orders.delete',
  ORDERS_APPROVE: 'orders.approve',
  ORDERS_CANCEL: 'orders.cancel',

  // 마감 자료
  CLOSINGS_VIEW: 'closings.view',
  CLOSINGS_UPDATE: 'closings.update',
  CLOSINGS_APPROVE: 'closings.approve',

  // 결제 관련
  PAYMENTS_VIEW: 'payments.view',
  PAYMENTS_CREATE: 'payments.create',
  PAYMENTS_UPDATE: 'payments.update',
  PAYMENTS_APPROVE: 'payments.approve',
  PAYMENTS_REFUND: 'payments.refund',

  // 환불 관련
  REFUNDS_VIEW: 'refunds.view',
  REFUNDS_CREATE: 'refunds.create',
  REFUNDS_APPROVE: 'refunds.approve',

  // 정산 관련
  SETTLEMENTS_VIEW: 'settlements.view',
  SETTLEMENTS_CREATE: 'settlements.create',
  SETTLEMENTS_UPDATE: 'settlements.update',
  SETTLEMENTS_APPROVE: 'settlements.approve',
  SETTLEMENTS_EXPORT: 'settlements.export',

  // 차감 관련
  DEDUCTIONS_VIEW: 'deductions.view',
  DEDUCTIONS_CREATE: 'deductions.create',
  DEDUCTIONS_UPDATE: 'deductions.update',
  DEDUCTIONS_DELETE: 'deductions.delete',

  // 헬퍼 관련
  HELPERS_VIEW: 'helpers.view',
  HELPERS_CREATE: 'helpers.create',
  HELPERS_UPDATE: 'helpers.update',
  HELPERS_DELETE: 'helpers.delete',
  HELPERS_APPROVE: 'helpers.approve',
  HELPERS_SUSPEND: 'helpers.suspend',

  // 요청자 관련
  REQUESTERS_VIEW: 'requesters.view',
  REQUESTERS_CREATE: 'requesters.create',
  REQUESTERS_UPDATE: 'requesters.update',
  REQUESTERS_DELETE: 'requesters.delete',
  REQUESTERS_APPROVE: 'requesters.approve',
  REQUESTERS_SUSPEND: 'requesters.suspend',

  // 운임/정책 관련
  RATES_VIEW: 'rates.view',
  RATES_UPDATE: 'rates.update',

  REFUND_POLICY_VIEW: 'refundPolicy.view',
  REFUND_POLICY_UPDATE: 'refundPolicy.update',

  // 이의제기 관련
  DISPUTES_VIEW: 'disputes.view',
  DISPUTES_CREATE: 'disputes.create',
  DISPUTES_UPDATE: 'disputes.update',
  DISPUTES_RESOLVE: 'disputes.resolve',

  // 사고 관련
  INCIDENTS_VIEW: 'incidents.view',
  INCIDENTS_CREATE: 'incidents.create',
  INCIDENTS_UPDATE: 'incidents.update',
  INCIDENTS_RESOLVE: 'incidents.resolve',

  // CS 관련
  CS_VIEW: 'cs.view',
  CS_CREATE: 'cs.create',
  CS_UPDATE: 'cs.update',
  CS_RESOLVE: 'cs.resolve',

  // 공지/알림
  NOTIFICATIONS_VIEW: 'notifications.view',
  NOTIFICATIONS_CREATE: 'notifications.create',
  NOTIFICATIONS_UPDATE: 'notifications.update',
  NOTIFICATIONS_DELETE: 'notifications.delete',
  NOTIFICATIONS_SEND: 'notifications.send',

  // 감사 로그
  AUDIT_LOGS_VIEW: 'auditLogs.view',
  AUDIT_LOGS_EXPORT: 'auditLogs.export',

  // 직원/권한 관리
  STAFF_VIEW: 'staff.view',
  STAFF_CREATE: 'staff.create',
  STAFF_UPDATE: 'staff.update',
  STAFF_DELETE: 'staff.delete',
  STAFF_MANAGE_PERMISSIONS: 'staff.managePermissions',

  // 시스템 설정
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_UPDATE: 'settings.update',
} as const;

// ===== 권한 그룹 (역할별 기본 권한 세트) =====
export const PERMISSION_GROUPS = {
  // 슈퍼 관리자 (모든 권한)
  SUPER_ADMIN: Object.values(PERMISSIONS),

  // 일반 관리자 (직원 관리 제외)
  ADMIN: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.TASK_QUEUE_VIEW,
    PERMISSIONS.TASK_QUEUE_MANAGE,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_UPDATE,
    PERMISSIONS.ORDERS_APPROVE,
    PERMISSIONS.CLOSINGS_VIEW,
    PERMISSIONS.CLOSINGS_UPDATE,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.PAYMENTS_APPROVE,
    PERMISSIONS.REFUNDS_VIEW,
    PERMISSIONS.REFUNDS_APPROVE,
    PERMISSIONS.SETTLEMENTS_VIEW,
    PERMISSIONS.SETTLEMENTS_APPROVE,
    PERMISSIONS.HELPERS_VIEW,
    PERMISSIONS.HELPERS_APPROVE,
    PERMISSIONS.REQUESTERS_VIEW,
    PERMISSIONS.REQUESTERS_APPROVE,
    PERMISSIONS.DISPUTES_VIEW,
    PERMISSIONS.DISPUTES_RESOLVE,
    PERMISSIONS.INCIDENTS_VIEW,
    PERMISSIONS.INCIDENTS_RESOLVE,
    PERMISSIONS.CS_VIEW,
    PERMISSIONS.CS_RESOLVE,
    PERMISSIONS.NOTIFICATIONS_VIEW,
    PERMISSIONS.AUDIT_LOGS_VIEW,
  ],

  // CS 담당자 (고객 지원 중심)
  CS_OPERATOR: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.HELPERS_VIEW,
    PERMISSIONS.REQUESTERS_VIEW,
    PERMISSIONS.CS_VIEW,
    PERMISSIONS.CS_CREATE,
    PERMISSIONS.CS_UPDATE,
    PERMISSIONS.CS_RESOLVE,
    PERMISSIONS.NOTIFICATIONS_VIEW,
  ],

  // 정산 담당자 (정산 업무 중심)
  SETTLEMENT_OPERATOR: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.SETTLEMENTS_VIEW,
    PERMISSIONS.SETTLEMENTS_CREATE,
    PERMISSIONS.SETTLEMENTS_UPDATE,
    PERMISSIONS.SETTLEMENTS_APPROVE,
    PERMISSIONS.SETTLEMENTS_EXPORT,
    PERMISSIONS.DEDUCTIONS_VIEW,
    PERMISSIONS.DEDUCTIONS_CREATE,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.REFUNDS_VIEW,
  ],

  // 오더 관리자 (오더 운영 중심)
  ORDER_OPERATOR: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.TASK_QUEUE_VIEW,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_UPDATE,
    PERMISSIONS.ORDERS_APPROVE,
    PERMISSIONS.CLOSINGS_VIEW,
    PERMISSIONS.CLOSINGS_UPDATE,
    PERMISSIONS.HELPERS_VIEW,
    PERMISSIONS.REQUESTERS_VIEW,
  ],

  // 읽기 전용 (조회만 가능)
  VIEWER: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.CLOSINGS_VIEW,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.SETTLEMENTS_VIEW,
    PERMISSIONS.HELPERS_VIEW,
    PERMISSIONS.REQUESTERS_VIEW,
    PERMISSIONS.DISPUTES_VIEW,
    PERMISSIONS.INCIDENTS_VIEW,
    PERMISSIONS.CS_VIEW,
    PERMISSIONS.AUDIT_LOGS_VIEW,
  ],
} as const;

// ===== 타입 정의 =====
export type MenuKey = typeof MENU_KEYS[keyof typeof MENU_KEYS];
export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];
export type PermissionGroup = keyof typeof PERMISSION_GROUPS;

// ===== 유틸리티 함수 =====

/**
 * 권한 키가 유효한지 확인
 */
export function isValidPermission(permission: string): permission is Permission {
  return Object.values(PERMISSIONS).includes(permission as Permission);
}

/**
 * 메뉴 키가 유효한지 확인
 */
export function isValidMenuKey(menuKey: string): menuKey is MenuKey {
  return Object.values(MENU_KEYS).includes(menuKey as MenuKey);
}

/**
 * 권한 그룹의 권한 목록 가져오기
 */
export function getPermissionsByGroup(group: PermissionGroup): Permission[] {
  return [...PERMISSION_GROUPS[group]];
}

/**
 * 여러 권한 그룹 병합
 */
export function mergePermissionGroups(...groups: PermissionGroup[]): Permission[] {
  const allPermissions = groups.flatMap(group => PERMISSION_GROUPS[group]);
  return [...new Set(allPermissions)];
}

/**
 * 액션별 권한 필터링 (예: 모든 'view' 권한만)
 */
export function filterPermissionsByAction(action: 'view' | 'create' | 'update' | 'delete' | 'approve' | 'manage'): Permission[] {
  return Object.values(PERMISSIONS).filter(p => p.endsWith(`.${action}`)) as Permission[];
}
