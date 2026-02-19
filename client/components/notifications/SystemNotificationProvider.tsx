import React, { createContext, useContext, useState, useCallback } from 'react';
import { SystemAlert, SystemAlertConfig } from './SystemAlert';
import { SystemToast, SystemToastConfig } from './SystemToast';

interface SystemNotificationContextType {
    showAlert: (config: Omit<SystemAlertConfig, 'cancelable'> & { cancelable?: boolean }) => void;
    showToast: (config: SystemToastConfig) => void;
}

const SystemNotificationContext = createContext<SystemNotificationContextType | undefined>(undefined);

interface ToastInstance {
    id: string;
    config: SystemToastConfig;
}

export function SystemNotificationProvider({ children }: { children: React.ReactNode }) {
    const [alertConfig, setAlertConfig] = useState<SystemAlertConfig | null>(null);
    const [toasts, setToasts] = useState<ToastInstance[]>([]);

    const showAlert = useCallback((config: Omit<SystemAlertConfig, 'cancelable'> & { cancelable?: boolean }) => {
        setAlertConfig({
            ...config,
            cancelable: config.cancelable ?? true,
        } as SystemAlertConfig);
    }, []);

    const showToast = useCallback((config: SystemToastConfig) => {
        const id = `toast-${Date.now()}-${Math.random()}`;
        setToasts((prev) => [...prev, { id, config }]);
    }, []);

    const dismissAlert = useCallback(() => {
        setAlertConfig(null);
    }, []);

    const dismissToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    return (
        <SystemNotificationContext.Provider value={{ showAlert, showToast }}>
            {children}

            {/* Alert Modal */}
            {alertConfig && (
                <SystemAlert
                    visible={!!alertConfig}
                    config={alertConfig}
                    onDismiss={dismissAlert}
                />
            )}

            {/* Toast Stack */}
            {toasts.map((toast, index) => (
                <SystemToast
                    key={toast.id}
                    id={toast.id}
                    config={toast.config}
                    index={index}
                    onDismiss={dismissToast}
                />
            ))}
        </SystemNotificationContext.Provider>
    );
}

// Hooks
export function useSystemAlert() {
    const context = useContext(SystemNotificationContext);
    if (!context) {
        throw new Error('useSystemAlert must be used within SystemNotificationProvider');
    }
    return context.showAlert;
}

export function useSystemToast() {
    const context = useContext(SystemNotificationContext);
    if (!context) {
        throw new Error('useSystemToast must be used within SystemNotificationProvider');
    }
    return context.showToast;
}

// Convenience hooks for specific types
export function useSystemNotification() {
    const showAlert = useSystemAlert();
    const showToast = useSystemToast();

    return {
        // Alert methods
        alert: {
            info: (title: string, message: string, buttons?: SystemAlertConfig['buttons']) =>
                showAlert({ type: 'info', title, message, buttons }),
            success: (title: string, message: string, buttons?: SystemAlertConfig['buttons']) =>
                showAlert({ type: 'success', title, message, buttons }),
            warning: (title: string, message: string, buttons?: SystemAlertConfig['buttons']) =>
                showAlert({ type: 'warning', title, message, buttons }),
            error: (title: string, message: string, buttons?: SystemAlertConfig['buttons']) =>
                showAlert({ type: 'error', title, message, buttons }),
        },

        // Toast methods
        toast: {
            info: (message: string, title?: string, duration?: number) =>
                showToast({ type: 'info', message, title, duration }),
            success: (message: string, title?: string, duration?: number) =>
                showToast({ type: 'success', message, title, duration }),
            warning: (message: string, title?: string, duration?: number) =>
                showToast({ type: 'warning', message, title, duration }),
            error: (message: string, title?: string, duration?: number) =>
                showToast({ type: 'error', message, title, duration }),
        },

        // Drop-in replacement for Alert.alert(title, message, buttons)
        sysAlert: (
            title: string,
            message: string,
            buttons?: Array<{ text: string; onPress?: () => void; style?: string }>,
        ) => {
            const mapped = buttons?.map((b) => ({
                text: b.text,
                onPress: b.onPress,
                style: (b.style === 'cancel' ? 'secondary' : b.style === 'destructive' ? 'destructive' : 'primary') as 'primary' | 'secondary' | 'destructive',
            }));
            showAlert({ type: 'info', title, message, buttons: mapped });
        },
    };
}
