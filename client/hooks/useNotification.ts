import { useContext } from 'react';
import { NotificationContext } from '../contexts/NotificationContext';
import type { NotificationContextValue } from '../types/notification';

/**
 * Hook to access the notification system
 *
 * @example
 * ```typescript
 * const notification = useNotification();
 *
 * // Show success toast
 * notification.success('작업이 완료되었습니다.', '완료');
 *
 * // Show error toast
 * notification.error('오류가 발생했습니다.', '오류');
 *
 * // Show confirmation dialog
 * notification.confirm({
 *   title: '삭제 확인',
 *   message: '정말로 삭제하시겠습니까?',
 *   onConfirm: () => deleteMutation.mutate(),
 * });
 * ```
 */
export function useNotification(): NotificationContextValue {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }

  return context;
}
