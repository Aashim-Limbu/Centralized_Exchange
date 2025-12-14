// Engine message types
export const CREATE_ORDER = "CREATE_ORDER" as const;
export const CANCEL_ORDER = "CANCEL_ORDER" as const;
export const ON_RAMP = "ON_RAMP" as const;
export const GET_OPEN_ORDERS = "GET_OPEN_ORDERS" as const;
export const GET_DEPTH = "GET_DEPTH" as const;

// Orderbook response types
export const DEPTH = "DEPTH" as const;
export const ORDER_PLACED = "ORDER_PLACED" as const;
export const ORDER_CANCELLED = "ORDER_CANCELLED" as const;
export const OPEN_ORDERS = "OPEN_ORDERS" as const;
