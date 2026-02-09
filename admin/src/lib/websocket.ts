/**
 * Admin WebSocket Client
 * 실시간 업데이트를 위한 WebSocket 연결 관리
 */

type WebSocketEventHandler = (data: any) => void;

class AdminWebSocket {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 3000; // 3초
  private eventHandlers: Map<string, Set<WebSocketEventHandler>> = new Map();
  private userId: string | null = null;
  private isIntentionalClose = false;

  /**
   * WebSocket 연결 시작
   */
  connect(userId: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[AdminWS] Already connected');
      return;
    }

    this.userId = userId;
    this.isIntentionalClose = false;

    // WebSocket URL 구성 (환경에 따라 ws:// 또는 wss://)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/notifications?userId=${userId}`;

    console.log('[AdminWS] Connecting to:', wsUrl);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[AdminWS] Connected successfully');
        this.reconnectAttempts = 0;
        this.clearReconnectTimer();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('[AdminWS] Failed to parse message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[AdminWS] WebSocket error:', error);
      };

      this.ws.onclose = (event) => {
        console.log('[AdminWS] Connection closed:', event.code, event.reason);
        this.ws = null;

        // 의도적인 종료가 아니면 재연결 시도
        if (!this.isIntentionalClose) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      console.error('[AdminWS] Failed to create WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * WebSocket 연결 종료
   */
  disconnect() {
    this.isIntentionalClose = true;
    this.clearReconnectTimer();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.eventHandlers.clear();
    console.log('[AdminWS] Disconnected');
  }

  /**
   * 이벤트 핸들러 등록
   */
  on(event: string, handler: WebSocketEventHandler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * 이벤트 핸들러 제거
   */
  off(event: string, handler: WebSocketEventHandler) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * 메시지 처리
   */
  private handleMessage(message: { event: string; data: any }) {
    const { event, data } = message;

    // admin_update 이벤트를 실제 이벤트 타입으로 변환
    if (event === 'admin_update') {
      const actualEvent = data.type;
      const handlers = this.eventHandlers.get(actualEvent);

      if (handlers) {
        handlers.forEach((handler) => handler(data.data));
      }
    } else {
      // 일반 이벤트 처리
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        handlers.forEach((handler) => handler(data));
      }
    }
  }

  /**
   * 재연결 스케줄링
   */
  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[AdminWS] Max reconnect attempts reached');
      return;
    }

    this.clearReconnectTimer();

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      30000 // 최대 30초
    );

    console.log(
      `[AdminWS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      if (this.userId) {
        this.connect(this.userId);
      }
    }, delay);
  }

  /**
   * 재연결 타이머 클리어
   */
  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * 연결 상태 확인
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * 연결 상태 반환
   */
  getReadyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }
}

// 싱글톤 인스턴스
export const adminWebSocket = new AdminWebSocket();
