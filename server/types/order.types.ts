/**
 * Order Types
 */

export interface CreateOrderData {
  requesterId: string;
  title: string;
  description?: string;
  pickupAddress: string;
  deliveryAddress: string;
  scheduledDate: Date;
  orderCategory: string;
  pricePerUnit: number;
  averageQuantity: string;
}

export interface OrderFilter {
  status?: string;
  requesterId?: string;
  helperId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface OrderUpdate {
  status?: string;
  helperId?: string;
  scheduledDate?: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
}

export interface OrderApplication {
  orderId: number;
  helperId: string;
  message?: string;
}

export interface OrderStatusTransition {
  orderId: number;
  fromStatus: string;
  toStatus: string;
  userId: string;
  reason?: string;
}
