/**
 * Integrated Order Hook
 * 통합 오더 상세 정보 API 훅
 */

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import type { IntegratedOrderDetail } from '@/types/integratedOrder';

/**
 * 통합 오더 상세 정보 조회
 */
export function useIntegratedOrder(orderId: number | string) {
  return useQuery<{ success: boolean; data: IntegratedOrderDetail }>({
    queryKey: ['admin', 'orders', orderId, 'integrated'],
    queryFn: () => apiRequest(`/orders/${orderId}/integrated`),
    enabled: !!orderId,
  });
}
