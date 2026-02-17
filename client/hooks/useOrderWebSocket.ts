import { useEffect, useRef, useCallback, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '@/lib/query-client';
import { getToken } from '@/utils/secure-token-storage';

type WebSocketEvent = {
  event: string;
  data: any;
};

const MAX_RECONNECT_DELAY = 30000;
const BASE_RECONNECT_DELAY = 3000;

export function useOrderWebSocket() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN || isConnectingRef.current) {
      return;
    }

    isConnectingRef.current = true;

    try {
      const token = await getToken();
      if (!token) {
        isConnectingRef.current = false;
        return;
      }

      const userDataStr = await AsyncStorage.getItem('user_data');
      if (!userDataStr) {
        isConnectingRef.current = false;
        return;
      }

      const userData = JSON.parse(userDataStr);
      const userId = userData.id;

      if (!userId) {
        isConnectingRef.current = false;
        return;
      }

      const apiUrl = getApiUrl();
      const wsUrl = apiUrl
        .replace('https://', 'wss://')
        .replace('http://', 'ws://')
        .replace(/\/$/, '');

      const ws = new WebSocket(`${wsUrl}/ws/notifications?userId=${userId}&token=${token}`);

      ws.onopen = () => {
        isConnectingRef.current = false;
        reconnectAttemptRef.current = 0;
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketEvent = JSON.parse(event.data);

          switch (message.event) {
            case 'new_order':
              queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
              break;
            case 'order_status_updated':
              queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
              queryClient.invalidateQueries({ queryKey: ['/api/orders/my-applications'] });
              queryClient.invalidateQueries({ queryKey: ['/api/helper/my-orders'] });
              break;
            case 'data_refresh':
              if (message.data?.type === 'order' || message.data?.type === 'all') {
                queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
              }
              if (message.data?.type === 'settlement' || message.data?.type === 'all') {
                queryClient.invalidateQueries({ queryKey: ['/api/helper/settlements'] });
              }
              if (message.data?.type === 'onboarding' || message.data?.type === 'all') {
                queryClient.invalidateQueries({ queryKey: ['/api/helpers/onboarding-status'] });
              }
              if (message.data?.type === 'contract' || message.data?.type === 'all') {
                queryClient.invalidateQueries({ queryKey: ['/api/contracts'] });
              }
              break;
            case 'notification':
              // 알림 목록 갱신
              queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
              break;
          }
        } catch (e) {
          console.error('[WebSocket] Error parsing message:', e);
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        isConnectingRef.current = false;
      };

      ws.onclose = () => {
        isConnectingRef.current = false;
        wsRef.current = null;
        setIsConnected(false);

        // Exponential backoff 재연결
        const delay = Math.min(
          BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptRef.current),
          MAX_RECONNECT_DELAY
        );
        reconnectAttemptRef.current += 1;

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      isConnectingRef.current = false;
    }
  }, [queryClient]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // AppState 처리: 배경→복귀 시 재연결
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        // 앱이 포그라운드로 돌아왔을 때
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          reconnectAttemptRef.current = 0;
          connect();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    reconnect: connect,
  };
}
