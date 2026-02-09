/**
 * Admin WebSocket Utilities
 * 관리자 실시간 업데이트 헬퍼 함수 + 네이티브 앱 알림
 */

import { notificationWS } from '../websocket';
import { pool } from '../db';

/**
 * 관리자에게 실시간 업데이트 브로드캐스트
 */
export function broadcastAdminUpdate(
  eventType: 'order_updated' | 'settlement_updated' | 'helper_verified' | 'stats_updated' | 'task_queue_updated',
  data: any
) {
  // 실제로는 admin role을 가진 사용자들의 userId 목록을 가져와야 하지만
  // 현재는 연결된 모든 admin userId를 대상으로 브로드캐스트
  const connectedUserIds = notificationWS.getConnectedUserIds();

  // admin으로 시작하는 userId만 필터링 (또는 storage에서 admin role 체크)
  // 간단하게 모든 연결된 사용자에게 admin_update 이벤트 전송
  notificationWS.broadcastToAdmins(connectedUserIds, {
    type: eventType,
    action: 'broadcast',
    data,
  });
}

/**
 * 오더 승인 시 관리자 + 의뢰자/헬퍼에게 알림
 */
export async function notifyOrderApproved(orderIds: number[]) {
  // 1. 관리자들에게 알림
  broadcastAdminUpdate('order_updated', {
    orderIds,
    status: 'confirmed',
    timestamp: new Date().toISOString(),
  });

  broadcastAdminUpdate('task_queue_updated', {
    reason: 'orders_approved',
    count: orderIds.length,
  });

  // 2. 네이티브 앱(의뢰자/헬퍼)에게 알림
  try {
    const result = await pool.query(
      `SELECT id, requester_id, matched_helper_id
       FROM orders
       WHERE id = ANY($1)`,
      [orderIds]
    );

    result.rows.forEach((order: any) => {
      // 의뢰자에게 알림
      if (order.requester_id) {
        notificationWS.sendOrderStatusUpdate(order.requester_id, {
          orderId: order.id,
          status: 'confirmed',
        });

        notificationWS.sendToUser(order.requester_id, {
          type: 'order_approved',
          title: '오더 승인 완료',
          message: `오더 #${order.id}가 관리자에 의해 승인되었습니다.`,
          relatedId: order.id,
        });
      }

      // 헬퍼에게 알림 (이미 매칭된 경우)
      if (order.matched_helper_id) {
        notificationWS.sendOrderStatusUpdate(order.matched_helper_id, {
          orderId: order.id,
          status: 'confirmed',
        });

        notificationWS.sendToUser(order.matched_helper_id, {
          type: 'order_approved',
          title: '오더 승인 완료',
          message: `오더 #${order.id}가 승인되어 작업을 시작할 수 있습니다.`,
          relatedId: order.id,
        });
      }
    });
  } catch (error) {
    console.error('[notifyOrderApproved] 네이티브 앱 알림 실패:', error);
  }
}

/**
 * 정산 승인 시 관리자 + 헬퍼에게 알림
 */
export async function notifySettlementApproved(settlementIds: number[]) {
  // 1. 관리자들에게 알림
  broadcastAdminUpdate('settlement_updated', {
    settlementIds,
    status: 'approved',
    timestamp: new Date().toISOString(),
  });

  broadcastAdminUpdate('task_queue_updated', {
    reason: 'settlements_approved',
    count: settlementIds.length,
  });

  // 2. 네이티브 앱(헬퍼)에게 알림
  try {
    const result = await pool.query(
      `SELECT id, helper_id, amount
       FROM settlements
       WHERE id = ANY($1)`,
      [settlementIds]
    );

    result.rows.forEach((settlement: any) => {
      if (settlement.helper_id) {
        notificationWS.sendToUser(settlement.helper_id, {
          type: 'settlement_approved',
          title: '정산 승인 완료',
          message: `정산이 승인되었습니다. 곧 입금될 예정입니다. (${Number(settlement.amount).toLocaleString('ko-KR')}원)`,
          relatedId: settlement.id,
        });
      }
    });
  } catch (error) {
    console.error('[notifySettlementApproved] 네이티브 앱 알림 실패:', error);
  }
}

/**
 * 헬퍼 인증 시 관리자 + 헬퍼에게 알림
 */
export async function notifyHelperVerified(verificationIds: number[], userIds: string[]) {
  // 1. 관리자들에게 알림
  broadcastAdminUpdate('helper_verified', {
    verificationIds,
    userIds,
    timestamp: new Date().toISOString(),
  });

  broadcastAdminUpdate('task_queue_updated', {
    reason: 'helpers_verified',
    count: verificationIds.length,
  });

  // 2. 네이티브 앱(헬퍼)에게 알림
  userIds.forEach((userId) => {
    notificationWS.sendToUser(userId, {
      type: 'helper_verified',
      title: '헬퍼 인증 완료',
      message: '축하합니다! 헬퍼 인증이 완료되었습니다. 이제 오더에 지원할 수 있습니다.',
    });
  });
}

/**
 * 통계 업데이트 시 관리자에게 알림
 */
export function notifyStatsUpdated() {
  broadcastAdminUpdate('stats_updated', {
    timestamp: new Date().toISOString(),
  });
}
