import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '@/lib/query-client';
import { getToken } from '@/utils/secure-token-storage';

type WebSocketEvent = {
  event: string;
  data: any;
};

export function useOrderWebSocket() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isConnectingRef = useRef(false);

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
      
      const ws = new WebSocket(`${wsUrl}/ws/notifications?userId=${userId}`);

      ws.onopen = () => {
        if (__DEV__) console.log('[WebSocket] Connected for real-time order updates');
        isConnectingRef.current = false;
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketEvent = JSON.parse(event.data);
          
          if (message.event === 'new_order') {
            if (__DEV__) console.log('[WebSocket] New order received:', message.data);
            queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
          } else if (message.event === 'order_status_updated') {
            if (__DEV__) console.log('[WebSocket] Order status updated:', message.data);
            queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
            queryClient.invalidateQueries({ queryKey: ['/api/orders/my-applications'] });
          } else if (message.event === 'data_refresh') {
            if (message.data.type === 'order') {
              queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
            }
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
        if (__DEV__) console.log('[WebSocket] Disconnected, will reconnect in 5s');
        isConnectingRef.current = false;
        wsRef.current = null;
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 5000);
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
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    reconnect: connect,
  };
}
