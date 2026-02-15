import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { IncomingMessage } from "http";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-this";

interface UserConnection {
  userId: string;
  ws: WebSocket;
}

class NotificationWebSocket {
  private wss: WebSocketServer | null = null;
  private connections: Map<string, Set<WebSocket>> = new Map();

  initialize(server: Server) {
    this.wss = new WebSocketServer({ 
      server, 
      path: "/ws/notifications" 
    });

    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      const userId = url.searchParams.get("userId");
      const token = url.searchParams.get("token");

      // JWT 토큰 검증
      if (!token) {
        ws.close(4001, "Authentication token required");
        return;
      }

      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        
        // userId 일치 확인
        if (!decoded.userId || decoded.userId !== userId) {
          ws.close(4003, "Invalid token");
          return;
        }
      } catch (err) {
        ws.close(4002, "Invalid or expired token");
        return;
      }

      if (!userId) {
        ws.close(4001, "User ID required");
        return;
      }

      if (!this.connections.has(userId)) {
        this.connections.set(userId, new Set());
      }
      this.connections.get(userId)!.add(ws);

      console.log(`WebSocket connected: ${userId}`);

      ws.on("close", () => {
        const userConns = this.connections.get(userId);
        if (userConns) {
          userConns.delete(ws);
          if (userConns.size === 0) {
            this.connections.delete(userId);
          }
        }
        console.log(`WebSocket disconnected: ${userId}`);
      });

      ws.on("error", (error) => {
        console.error(`WebSocket error for ${userId}:`, error);
      });
    });

    console.log("WebSocket notification server initialized");
  }

  sendToUser(userId: string, notification: {
    type: string;
    title: string;
    message: string;
    relatedId?: number;
    phoneNumber?: string;
    payload?: any;
  }) {
    const userConns = this.connections.get(userId);
    if (userConns && userConns.size > 0) {
      const data = JSON.stringify({
        event: "notification",
        data: notification
      });
      
      userConns.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });
      return true;
    }
    return false;
  }

  broadcastToAll(notification: {
    type: string;
    title: string;
    message: string;
  }) {
    const data = JSON.stringify({
      event: "notification",
      data: notification
    });

    this.connections.forEach((conns) => {
      conns.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });
    });
  }

  getConnectedUserCount(): number {
    return this.connections.size;
  }

  // Send order status update to specific user for real-time UI refresh
  sendOrderStatusUpdate(userId: string, orderUpdate: {
    orderId: number;
    status: string;
    approvalStatus?: string;
    currentHelpers?: number;
    matchedHelperId?: string | null;
  }) {
    const userConns = this.connections.get(userId);
    if (userConns && userConns.size > 0) {
      const data = JSON.stringify({
        event: "order_status_updated",
        data: orderUpdate
      });
      
      userConns.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });
      return true;
    }
    return false;
  }

  // Send data refresh event to trigger cache invalidation
  sendDataRefresh(userId: string, refreshEvent: {
    type: "order" | "contract" | "settlement" | "checkin" | "user" | "onboarding" | "all";
    action: "created" | "updated" | "deleted";
    entityId?: number | string;
    metadata?: any;
  }) {
    const userConns = this.connections.get(userId);
    if (userConns && userConns.size > 0) {
      const data = JSON.stringify({
        event: "data_refresh",
        data: refreshEvent
      });
      
      userConns.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });
      return true;
    }
    return false;
  }

  // Broadcast to all admin users (for admin console real-time updates)
  broadcastToAdmins(adminUserIds: string[], event: {
    type: string;
    action: string;
    entityId?: number | string;
    data?: any;
  }) {
    const payload = JSON.stringify({
      event: "admin_update",
      data: event
    });

    adminUserIds.forEach((adminId) => {
      const adminConns = this.connections.get(adminId);
      if (adminConns) {
        adminConns.forEach((ws) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(payload);
          }
        });
      }
    });
  }

  // Get all connected user IDs (for broadcast targeting)
  getConnectedUserIds(): string[] {
    return Array.from(this.connections.keys());
  }

  // Broadcast new order notification to all helpers (for real-time job list updates)
  broadcastNewOrderToHelpers(helperUserIds: string[], orderData: {
    orderId: number;
    courierCompany?: string;
    deliveryArea?: string;
    scheduledDate?: string;
  }) {
    const payload = JSON.stringify({
      event: "new_order",
      data: orderData
    });

    helperUserIds.forEach((helperId) => {
      const helperConns = this.connections.get(helperId);
      if (helperConns) {
        helperConns.forEach((ws) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(payload);
          }
        });
      }
    });
  }
}

export const notificationWS = new NotificationWebSocket();
