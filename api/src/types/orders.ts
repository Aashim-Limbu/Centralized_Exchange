export type OrderSide = "buy" | "sell";

export interface Order {
  orderId: string;
  price: string;
  quantity: string;
  side: OrderSide;
  userId: string;
  executedQty: number;
}

export interface OrderFill {
  price: string;
  qty: number;
  tradeId: number;
}

export interface CreateOrderParams {
  market: string;
  price: string;
  quantity: string;
  side: OrderSide;
  userId: string;
}

export interface CancelOrderParams {
  orderId: string;
  market: string;
}
