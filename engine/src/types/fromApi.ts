type OrderSide = "BUY" | "SELL";
export const CREATE_ORDER = "CREATE_ORDER";
export const CANCEL_ORDER = "CANCEL_ORDER";
export const ON_RAMP = "ON_RAMP";

export const GET_DEPTH = "GET_DEPTH";
export const GET_OPEN_ORDERS = "GET_OPEN_ORDERS";

type CreateOrder = {
  type: typeof CREATE_ORDER;
  data: {
    market: string;
    price: string;
    quantity: string;
    side: OrderSide;
    userId: string;
  };
};
type CancelOrder = {
  type: typeof CANCEL_ORDER;
  data: {
    orderId: string;
    market: string;
  };
};
type OnRamp = {
  type: typeof ON_RAMP;
  data: {
    amount: string;
    userId: string;
    txnId: string;
  };
};
/**
 * @dev This retrieves the current state of the orderBook.
 */
type GetDepth = {
  type: typeof GET_DEPTH;
  data: {
    market: string;
  };
};
/**
 * @dev this is the type for user specific limit orders that haven't been filled yet.
 */
type GetOpenOrders = {
  type: typeof GET_OPEN_ORDERS;
  data: {
    userId: string;
    market: string;
  };
};
export type MessageFromApi =
  | CreateOrder
  | CancelOrder
  | GetDepth
  | OnRamp
  | GetOpenOrders;
