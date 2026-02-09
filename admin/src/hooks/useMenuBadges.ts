/**
 * Menu Badges Hook
 * 사이드바 메뉴 아이템의 알림 배지 카운트를 관리
 * WebSocket을 통한 실시간 업데이트 지원
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminFetch } from '@/lib/api';
import { adminWebSocket } from '@/lib/websocket';
import { useAuth } from '@/contexts/AuthContext';

export interface MenuBadgeCounts {
  // 오더 운영
  orders: number;           // 실시간 오더 관리 (새로운 오더)
  closings: number;         // 오더 마감 자료

  // 헬퍼 관리
  helpersPending: number;   // 신규 헬퍼 승인 대기

  // 요청자 관리
  requestersPending: number; // 신규 요청자 승인 대기

  // 이의제기/사고
  disputes: number;         // 이의제기 관리
  incidents: number;        // 화물사고 접수
  deductions: number;       // 화물사고 차감
  incidentRefunds: number;  // 화물사고 환불

  // CS
  cs: number;               // CS 문의

  // 정산
  settlementDaily: number;  // 일정산
  settlementHelper: number; // 헬퍼정산
  settlementRequester: number; // 요청자정산

  // 결제 및 환불
  paymentsDeposit: number;  // 계약금 결제
  paymentsBalance: number;  // 잔금 결제
  refunds: number;          // 환불

  // 업무 대기함
  taskQueue: number;        // 업무 대기함 총 개수
}

interface TaskQueueItem {
  taskType: string;
  referenceId: number;
  priority: number;
  waitingMinutes: number;
}

/**
 * 메뉴 배지 카운트를 가져오는 훅
 * - 초기 로드 시 task queue에서 카운트 계산
 * - WebSocket 이벤트로 실시간 업데이트
 */
export function useMenuBadges() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [badges, setBadges] = useState<MenuBadgeCounts>({
    orders: 0,
    closings: 0,
    helpersPending: 0,
    requestersPending: 0,
    disputes: 0,
    incidents: 0,
    deductions: 0,
    incidentRefunds: 0,
    cs: 0,
    settlementDaily: 0,
    settlementHelper: 0,
    settlementRequester: 0,
    paymentsDeposit: 0,
    paymentsBalance: 0,
    refunds: 0,
    taskQueue: 0,
  });

  // Task Queue 데이터 조회
  const { data: taskQueueData } = useQuery<{ data: TaskQueueItem[]; total: number }>({
    queryKey: ['admin', 'task-queue', 'badges'],
    queryFn: async () => {
      const res = await adminFetch('/api/admin/task-queue?limit=1000', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch task queue');
      return res.json();
    },
    refetchInterval: 30000, // 30초마다 자동 갱신
    enabled: !!user?.id,
  });

  // Task Queue 데이터로부터 배지 카운트 계산
  const calculateBadges = useCallback((tasks: TaskQueueItem[]): MenuBadgeCounts => {
    const counts: MenuBadgeCounts = {
      orders: 0,
      closings: 0,
      helpersPending: 0,
      requestersPending: 0,
      disputes: 0,
      incidents: 0,
      deductions: 0,
      incidentRefunds: 0,
      cs: 0,
      settlementDaily: 0,
      settlementHelper: 0,
      settlementRequester: 0,
      paymentsDeposit: 0,
      paymentsBalance: 0,
      refunds: 0,
      taskQueue: tasks.length,
    };

    tasks.forEach((task) => {
      switch (task.taskType) {
        case 'order_approval':
          counts.orders++;
          break;
        case 'helper_verification':
          counts.helpersPending++;
          break;
        case 'requester_verification':
          counts.requestersPending++;
          break;
        case 'settlement_approval':
          counts.settlementHelper++;
          break;
        case 'dispute_resolution':
          counts.disputes++;
          break;
        case 'incident_review':
          counts.incidents++;
          break;
        case 'cs_inquiry':
          counts.cs++;
          break;
        case 'refund_request':
          counts.refunds++;
          break;
        case 'payment_confirmation':
          counts.paymentsDeposit++;
          break;
        default:
          break;
      }
    });

    return counts;
  }, []);

  // Task Queue 데이터가 업데이트되면 배지 카운트 재계산
  useEffect(() => {
    if (taskQueueData?.data) {
      const newBadges = calculateBadges(taskQueueData.data);
      setBadges(newBadges);
    }
  }, [taskQueueData, calculateBadges]);

  // WebSocket 이벤트 핸들러 - 실시간 배지 업데이트
  useEffect(() => {
    if (!user?.id) return;

    const handleTaskQueueUpdate = () => {
      // Task Queue가 업데이트되면 쿼리 무효화하여 재조회
      queryClient.invalidateQueries({ queryKey: ['admin', 'task-queue', 'badges'] });
    };

    const handleOrderUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'task-queue', 'badges'] });
    };

    const handleSettlementUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'task-queue', 'badges'] });
    };

    const handleHelperVerified = () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'task-queue', 'badges'] });
    };

    // WebSocket 이벤트 리스너 등록
    adminWebSocket.on('task_queue_updated', handleTaskQueueUpdate);
    adminWebSocket.on('order_updated', handleOrderUpdate);
    adminWebSocket.on('settlement_updated', handleSettlementUpdate);
    adminWebSocket.on('helper_verified', handleHelperVerified);

    return () => {
      adminWebSocket.off('task_queue_updated', handleTaskQueueUpdate);
      adminWebSocket.off('order_updated', handleOrderUpdate);
      adminWebSocket.off('settlement_updated', handleSettlementUpdate);
      adminWebSocket.off('helper_verified', handleHelperVerified);
    };
  }, [user?.id, queryClient]);

  return badges;
}
