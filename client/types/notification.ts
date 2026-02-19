// Notification system types for Alert, Toast, NotificationContainer

// === Toast Types ===
export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'helper' | 'requester';

export interface ToastConfig {
  title?: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

export interface ToastInstance {
  id: string;
  config: ToastConfig;
}

// === Alert Types ===
export type AlertIconType = 'info' | 'warning' | 'error' | 'question';

export type AlertButtonStyle = 'default' | 'cancel' | 'destructive';

export interface AlertButton {
  text: string;
  style?: AlertButtonStyle;
  onPress?: () => void;
}

export interface AlertConfig {
  title: string;
  message: string;
  icon?: AlertIconType;
  buttons: AlertButton[];
  cancelable?: boolean;
}

export interface AlertInstance {
  id: string;
  config: AlertConfig;
}
