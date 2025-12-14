type Side = "BUY" | "SELL";
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
      return this.matchBuyOrder(order);
    } else {
      return this.matchSellOrder(order);
    }
  }

  private matchBuyOrder(order: Order) {
    const fills = [] as Fill[];
    let executedQty = 0;
    for (let i = 0; i < this.asks.length && executedQty < order.quantity; i++) {
      const ask = this.asks[i];
      if (!ask) continue;
      // Buy order if it can match ask price . Buy price >= Ask Price
      if (order.price >= ask.price) {
        const remainingQty = order.quantity - executedQty;
        const availableQty = ask.quantity - ask.filled;
        const fill_quantity = Math.min(remainingQty, availableQty);

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
          i--; // Since splice remove items from the array so moving one step before. [1,2,3] . remove 2 -> [1,2] so i reseting to 1 .
        }
      }
    }

    if (executedQty < order.quantity) {
      this.bids.push({
        ...order,
        filled: executedQty,
      });
      // keep the asks in descending order
      this.bids.sort((a, b) => b.price - a.price);
    }
    return { fills, executedQty };
  }

  private matchSellOrder(order: Order) {
    const fills: Fill[] = [];
    let executedQty = 0;
    for (let i = 0; i < this.bids.length && executedQty < order.quantity; i++) {
      const bid = this.bids[i];
      if (!bid) continue;
      if (order.price <= bid.price) {
        const remainingQty = order.quantity - executedQty;
        const availableQty = bid.quantity - bid.filled;
        const fillable_quantity = Math.min(remainingQty, availableQty);

        fills.push({
          price: bid.price,
          qty: fillable_quantity,
          tradeId: ++this.lastTradeId,
          otherUserId: bid.userId,
          marketOrderid: bid.orderId,
        });

        executedQty += fillable_quantity;
        bid.filled += fillable_quantity;

        this.currentPrice = bid.price;
        if (bid.filled === bid.quantity) {
          this.bids.splice(i, 1);
          i--;
        }
      }
    }
    if (executedQty < order.quantity) {
      this.asks.push({
        ...order,
        filled: executedQty,
      });
      // Sort in ascending order.
      this.asks.sort((a, b) => a.price - b.price);
    }
    return { fills, executedQty };
  }
}
