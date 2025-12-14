import {
  CANCEL_ORDER,
  CREATE_ORDER,
  DEPTH,
  GET_DEPTH,
  GET_OPEN_ORDERS,
  ON_RAMP,
  OPEN_ORDERS,
  ORDER_CANCELLED,
  ORDER_PLACED,
} from "../constants/messageTypes";
import type {
  Order,
  OrderFill,
  CreateOrderParams,
  CancelOrderParams,
} from "./orders.ts";
import type { MarketDepth, GetDepthParams } from "./market";

// Messages sent TO the engine
export type MessageToEngine =
  | {
      type: typeof CREATE_ORDER;
      data: CreateOrderParams;
    }
  | {
      type: typeof CANCEL_ORDER;
      data: CancelOrderParams;
    }
  | {
      type: typeof ON_RAMP;
      data: {
        amount: string;
        userId: string;
        txnId: string;
      };
    }
  | {
      type: typeof GET_DEPTH;
      data: GetDepthParams;
    }
  | {
      type: typeof GET_OPEN_ORDERS;
      data: {
        userId: string;
        market: string;
      };
    };

// Messages received FROM the orderbook
export type MessageFromOrderbook =
  | {
      type: typeof DEPTH;
      payload: MarketDepth;
    }
  | {
      type: typeof ORDER_PLACED;
      payload: {
        orderId: string;
        executedQty: number;
        fills: OrderFill[];
      };
    }
  | {
      type: typeof ORDER_CANCELLED;
      payload: {
        orderId: string;
        executedQty: number;
        remainingQty: number;
      };
    }
  | {
      type: typeof OPEN_ORDERS;
      payload: Order[];
    };
