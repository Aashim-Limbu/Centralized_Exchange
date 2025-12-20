export type Side = "BUY" | "SELL";
export interface Order {
  price: number;
  quantity: number;
  orderId: string;
  filled: number;
  side: Side;
  userId: string;
}
export interface Fill {
  price: number;
  qty: number;
  tradeId: number;
  otherUserId: string;
  marketOrderid: string;
}

// There is multiple orderBook in a Exchanges.
export class OrderBook {
  bids: Order[];
  asks: Order[];
  baseAsset: string;
  quoteAsset: string = "USD";
  lastTradeId: number;
  currentPrice: number;
  constructor(
    baseAsset: string,
    bids: Order[],
    asks: Order[],
    lastTradeId: number,
    currentPrice: number
  ) {
    this.bids = bids;
    this.asks = asks;
    this.baseAsset = baseAsset;
    this.lastTradeId = lastTradeId || 0;
    this.currentPrice = currentPrice || 0;
  }
  ticker() {
    return `${this.baseAsset}-${this.quoteAsset}`;
  }
  // This is for replicating the orderbooks . Each orderbook is snapshotted after certain intervals.
  getSnapshot() {
    return {
      baseAsset: this.baseAsset,
      bids: this.bids,
      asks: this.asks,
      lastTradeId: this.lastTradeId,
      currentPrice: this.currentPrice,
    };
  }
  addOrder(order: Order) {
    if (order.side === "BUY") {
      return this.matchBuyOrderOptimized(order);
    } else {
      return this.matchSellOrderOptimized(order);
    }
  }

  /**
   *
   * @param order The order the retailer places
   * @returns executed quantity and the fills
   * @dev The retails buy on what the Market Maker asks
   * i. if the order.price < lowest market price just return.
   * ii. There should be always executedquantity <= ask.quantity
   * iii. we track the bids and ask via the bids and asks with filled and quantity params. [By design filled is the order consumed for the price could be either asks/bids]
   */
  private matchBuyOrderOptimized(order: Order) {
    let executedQty = 0;
    const fills = [] as Fill[];
    for (let i = 0; i < this.asks.length && executedQty < order.quantity; i++) {
      const ask = this.asks[i]; // the orderbooks asks present at the time.
      if (!ask) continue;
      if (ask.price > order.price) break;
      let remainingQty = order.quantity - executedQty;
      let availableQty = ask.quantity - ask.filled;
      const fill_quantity = Math.min(remainingQty, availableQty);
      if (fill_quantity <= 0) continue;
      fills.push({
        price: ask.price,
        qty: fill_quantity,
        tradeId: ++this.lastTradeId,
        otherUserId: ask.userId,
        marketOrderid: ask.orderId,
      });
      executedQty += fill_quantity;
      ask.filled += fill_quantity;
      this.currentPrice = ask.price;
      if (ask.filled === ask.quantity) {
        this.asks.splice(i, 1);
        i--;
      }
    }
    // if the executed quantity is still smaller than
    if (executedQty < order.quantity) {
      this.bids.push({ ...order, filled: executedQty });
      this.bids.sort((a, b) => b.price - a.price);
    }
    return { fills, executedQty };
  }
  /**
   *
   * @param order This is the reatil order
   * MarketMaker buys the base Asset.
   * Retail sells the base Asset in return to quote assets.
   */
  private matchSellOrderOptimized(order: Order) {
    // Constraints
    // order.price >= bids.price
    // order.filled > bid.quantity at that price
    // if the order.quantity > executed quantity the order go to the asks.
    let executedQty = 0;
    let fills: Fill[] = [];
    for (let i = 0; i < this.bids.length && executedQty < order.quantity; i++) {
      const bid = this.bids[i];
      if (!bid) continue;
      if (bid.price < order.price) break;
      // order left to be filled
      let remaining_quantity = order.quantity - executedQty;
      // available order that could be filled in this loop.
      let available_quantity = bid.quantity - bid.filled;
      let fillable_quantity = Math.min(remaining_quantity, available_quantity);
      fills.push({
        price: order.price,
        qty: fillable_quantity,
        tradeId: ++this.lastTradeId,
        otherUserId: order.userId,
        marketOrderid: bid.orderId,
      });
      bid.filled += fillable_quantity;
      executedQty += fillable_quantity;
      this.currentPrice = order.price;
      if (bid.quantity === bid.filled) {
        this.bids.splice(i, 1);
        i--;
      }
    }
    if (executedQty < order.quantity) {
      this.asks.push({ ...order, filled: executedQty });
      this.asks.sort((a, b) => a.price - b.price);
    }
    return { executedQty, fills };
  }
}
