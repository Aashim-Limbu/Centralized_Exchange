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
  private depthCache: {
    bids: Map<number, number>;
    asks: Map<number, number>;
  };
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
    this.depthCache = {
      bids: new Map(),
      asks: new Map(),
    };
    this.rebuildDepthCache();
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
  cancelBid(order: Order) {
    const index = this.bids.findIndex((x) => x.orderId === order.orderId);
    if (index === -1) {
      throw new Error(`No bid found for this id: ${order.orderId} `);
    }
    const price = this.bids[index]!.price;
    this.bids.splice(index, 1);
    return price;
  }
  cancelAsk(order: Order) {
    const index = this.asks.findIndex((o) => o.orderId === order.orderId);
    if (index === -1) {
      throw new Error(`Not a single ask found for this id: ${order.orderId}`);
    }
    const price = this.asks[index]!.price;
    this.bids.splice(index, 1);
    return price;
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
  private rebuildDepthCache() {
    this.depthCache.asks.clear();
    this.depthCache.bids.clear();
    for (const bid of this.bids) {
      const remaining = bid.quantity - bid.filled;
      const cacheBids = this.depthCache.bids;
      const current = cacheBids.get(bid.price) || 0;
      cacheBids.set(bid.price, current + remaining);
    }
    for (const ask of this.asks) {
      const remaining = ask.quantity - ask.filled;
      const cacheAsks = this.depthCache.asks;
      const current = cacheAsks.get(ask.price) || 0;
      cacheAsks.set(ask.price, current + remaining);
    }
  }
  private updateDepthOnAdd(price: number, quantity: number, side: Side) {
    const map = side === "BUY" ? this.depthCache.bids : this.depthCache.asks;
    const current = map.get(price) || 0;
    map.set(price, current + quantity);
  }
  private updateDepthOnRemove(
    price: number,
    quantity: number,
    side: Side
  ) {
    const map = side === "BUY" ? this.depthCache.bids : this.depthCache.asks;
    const current = map.get(price) || 0;
    const newQty = current - quantity;

    if (newQty <= 0) {
      map.delete(price);
    } else {
      map.set(price, newQty);
    }
  }
  getDepth() {
    const bids: [string, string][] = [];
    const asks: [string, string][] = [];

    // Convert Map to array format
    for (const [price, qty] of this.depthCache.bids.entries()) {
      bids.push([price.toString(), qty.toString()]);
    }

    for (const [price, qty] of this.depthCache.asks.entries()) {
      asks.push([price.toString(), qty.toString()]);
    }

    // Sort for display (optional but nice)
    bids.sort((a, b) => Number(b[0]) - Number(a[0])); // Descending
    asks.sort((a, b) => Number(a[0]) - Number(b[0])); // Ascending

    return { bids, asks };
  }
}
