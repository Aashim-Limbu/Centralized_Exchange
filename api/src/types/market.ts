export type PriceLevel = [string, string]; // [price, quantity]

export interface MarketDepth {
  market: string;
  bids: PriceLevel[];
  asks: PriceLevel[];
}

export interface GetDepthParams {
  market: string;
}
