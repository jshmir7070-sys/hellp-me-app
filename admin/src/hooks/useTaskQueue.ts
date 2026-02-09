/**
 * Task Queue Hooks
 * 업무 대기함 API 훅
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import type {
  DashboardOverview,
  TaskQueueItem,
  BatchApprovalResult,
  TaskType
} from '@/types/taskQueue';

/**
 * 통합 대시보드 조회
 * WebSocket 실시간 업데이트가 있으므로 폴링 간격을 늘림
 */
export function useDashboardOverview() {
  return useQuery<{ success: boolean; data: DashboardOverview }>({
    queryKey: ['admin', 'dashboard', 'overview'],
    queryFn: () => apiRequest('/dashboard/overview'),
    refetchInterval: 30000, // 30초마다 백업 폴링 (WebSocket이 주 업데이트 수단)
  });
}

/**
 * 업무 대기함 목록 조회
 * WebSocket 실시간 업데이트가 있으므로 폴링 간격을 늘림
 */
export function useTaskQueue(filters?: {
  taskType?: TaskType;
  minPriority?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.taskType) params.append('taskType', filters.taskType);
  if (filters?.minPriority) params.append('minPriority', String(filters.minPriority));
  if (filters?.limit) params.append('limit', String(filters.limit));

  const queryString = params.toString();

  return useQuery<{ success: boolean; data: TaskQueueItem[]; total: number }>({
    queryKey: ['admin', 'task-queue', filters],
    queryFn: () => apiRequest(`/task-queue${queryString ? `?${queryString}` : ''}`),
    refetchInterval: 30000, // 30초마다 백업 폴링 (WebSocket이 주 업데이트 수단)
  });
}

/**
 * 오더 일괄 승인
 */
export function useBatchApproveOrders() {
  const queryClient = useQueryClient();

  return useMutation<
    { success: boolean; data: BatchApprovalResult },
    Error,
    { orderIds: number[] }
  >({
    mutationFn: (data) =>
      apiRequest('/batch/approve-orders', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      // 관련 쿼리 무효화하여 자동 새로고침
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'task-queue'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

/**
 * 정산 일괄 승인
 */
export function useBatchApproveSettlements() {
  const queryClient = useQueryClient();

  return useMutation<
    { success: boolean; data: BatchApprovalResult },
    Error,
    { settlementIds: number[] }
  >({
    mutationFn: (data) =>
      apiRequest('/batch/approve-settlements', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'task-queue'] });
      queryClient.invalidateQueries({ queryKey: ['settlements'] });
    },
  });
}

/**
 * 헬퍼 일괄 인증
 */
export function useBatchVerifyHelpers() {
  const queryClient = useQueryClient();

  return useMutation<
    { success: boolean; data: BatchApprovalResult },
    Error,
    { verificationIds: number[] }
  >({
    mutationFn: (data) =>
      apiRequest('/batch/verify-helpers', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'task-queue'] });
      queryClient.invalidateQueries({ queryKey: ['helpers'] });
    },
  });
}
