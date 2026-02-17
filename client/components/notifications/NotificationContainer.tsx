import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Toast } from './Toast';
import { Alert } from './Alert';
import type { ToastInstance, AlertInstance } from '@/types/notification';

interface NotificationContainerProps {
  toasts: ToastInstance[];
  alert: AlertInstance | null;
  onDismissToast: (id: string) => void;
  onDismissAlert: () => void;
}

export function NotificationContainer({
  toasts,
  alert,
  onDismissToast,
  onDismissAlert,
}: NotificationContainerProps) {
  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Toasts */}
      {toasts.map((toast, index) => (
        <Toast
          key={toast.id}
          instance={toast}
          index={index}
          onDismiss={onDismissToast}
        />
      ))}

      {/* Alert dialog */}
      {alert && (
        <Alert
          instance={alert}
          onDismiss={onDismissAlert}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
});
