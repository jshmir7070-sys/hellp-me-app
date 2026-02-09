/**
 * Admin WebSocket Hook
 * WebSocket 이벤트를 React Query와 통합
 */

import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { adminWebSocket } from '@/lib/websocket';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from './use-toast';

/**
 * 관리자 WebSocket 연결 및 실시간 업데이트 훅
 */
export function useAdminWebSocket() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  // 오더 업데이트 핸들러
  const handleOrderUpdated = useCallback(
    (data: { orderIds: number[]; status: string; timestamp: string }) => {
      console.log('[AdminWS] Order updated:', data);

      // React Query 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'task-queue'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });

      // Toast 알림
      toast({
        title: '오더 업데이트',
        description: `${data.orderIds.length}개의 오더가 ${data.status}로 변경되었습니다.`,
      });
    },
    [queryClient, toast]
  );

  // 정산 업데이트 핸들러
  const handleSettlementUpdated = useCallback(
    (data: { settlementIds: number[]; status: string; timestamp: string }) => {
      console.log('[AdminWS] Settlement updated:', data);

      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'task-queue'] });
      queryClient.invalidateQueries({ queryKey: ['settlements'] });

      toast({
        title: '정산 업데이트',
        description: `${data.settlementIds.length}개의 정산이 ${data.status}로 변경되었습니다.`,
      });
    },
    [queryClient, toast]
  );

  // 헬퍼 인증 핸들러
  const handleHelperVerified = useCallback(
    (data: { verificationIds: number[]; userIds: string[]; timestamp: string }) => {
      console.log('[AdminWS] Helper verified:', data);

      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'task-queue'] });
      queryClient.invalidateQueries({ queryKey: ['helpers'] });

      toast({
        title: '헬퍼 인증 완료',
        description: `${data.verificationIds.length}명의 헬퍼가 인증되었습니다.`,
      });
    },
    [queryClient, toast]
  );

  // 통계 업데이트 핸들러
  const handleStatsUpdated = useCallback(
    (data: { timestamp: string }) => {
      console.log('[AdminWS] Stats updated:', data);

      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
    [queryClient]
  );

  // Task Queue 업데이트 핸들러
  const handleTaskQueueUpdated = useCallback(
    (data: { reason: string; count: number }) => {
      console.log('[AdminWS] Task queue updated:', data);

      // Task Queue 관련 쿼리만 무효화
      queryClient.invalidateQueries({ queryKey: ['admin', 'task-queue'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard', 'overview'] });
    },
    [queryClient]
  );

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    // WebSocket 연결
    adminWebSocket.connect(user.id);

    // 이벤트 핸들러 등록
    adminWebSocket.on('order_updated', handleOrderUpdated);
    adminWebSocket.on('settlement_updated', handleSettlementUpdated);
    adminWebSocket.on('helper_verified', handleHelperVerified);
    adminWebSocket.on('stats_updated', handleStatsUpdated);
    adminWebSocket.on('task_queue_updated', handleTaskQueueUpdated);

    // 클린업: 컴포넌트 언마운트 시 이벤트 핸들러 제거
    return () => {
      adminWebSocket.off('order_updated', handleOrderUpdated);
      adminWebSocket.off('settlement_updated', handleSettlementUpdated);
      adminWebSocket.off('helper_verified', handleHelperVerified);
      adminWebSocket.off('stats_updated', handleStatsUpdated);
      adminWebSocket.off('task_queue_updated', handleTaskQueueUpdated);

      // 로그아웃 시 연결 종료
      // adminWebSocket.disconnect();
    };
  }, [
    user?.id,
    handleOrderUpdated,
    handleSettlementUpdated,
    handleHelperVerified,
    handleStatsUpdated,
    handleTaskQueueUpdated,
  ]);

  return {
    isConnected: adminWebSocket.isConnected(),
    readyState: adminWebSocket.getReadyState(),
  };
}
