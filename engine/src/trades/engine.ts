import fs from "fs";
import { OrderBook, type Order, type Side } from "./orderbook";
import type { MessageFromApi } from "../types/fromApi";
import { CREATE_ORDER } from "../types/toApi";
import { safe } from "../lib/safe";

interface UserBalance {
  available: number;
  locked: number;
}
type Balance = Record<string, UserBalance>;
interface ProcessProps {
  message: MessageFromApi;
  clientId: string; // a channel where the engine publish message to api.
}
/**
balances = {
    "1": {
        NRS:  { available: 10000000, locked: 0 },
        GBRL: { available: 10000000, locked: 0 }
    },
    "2": {
        NRS:  { available: 10000000, locked: 0 },
        HRL: { available: 10000000, locked: 0 }
    }
}
*/
interface Snapshot {
  balances: Map<string, Balance>;
  orderbooks: OrderBook[];
}
export const BASE_CURRENCY = "USD";
export class Engine {
  private orderbooks: OrderBook[] = [];
  private balances: Map<string, Balance> = new Map();
  constructor() {
    let snapshot = null;
    try {
      if (process.env.WITH_SNAPSHOT) {
        snapshot = fs.readFileSync("./snapshot.json");
      }
    } catch (e) {
      console.log(`Error loading the snapshot ${e}`);
    }
    if (snapshot) {
      const snapShot = JSON.parse(snapshot.toString()) as Snapshot;
      this.orderbooks = snapShot.orderbooks.map(
        (orderbook) =>
          new OrderBook(
            orderbook.baseAsset,
            orderbook.bids,
            orderbook.asks,
            orderbook.lastTradeId,
            orderbook.lastTradeId
          )
      );
      this.balances = new Map(snapShot.balances);
    } else {
      this.orderbooks = [new OrderBook("Gold", [], [], 0, 0)];
      //   this.setBaseBalances();
    }
    // take snapshot after every 5 seconds.
    setTimeout(() => {
      this.saveSnapshot();
    }, 5000);
  }
  private saveSnapshot() {
    const snapshot = {
      orderbooks: this.orderbooks.map((o) => o.getSnapshot()),
      balances: Array.from(this.balances.entries()),
    };
    fs.writeFileSync("./snapshot.json", JSON.stringify(snapshot));
  }
  process({ message, clientId }: ProcessProps) {}
  createOrder(
    market: string,
    price: string,
    quantity: string,
    side: Side,
    userId: string
  ) {
    const orderbook = this.orderbooks.find((o) => o.ticker() == market);
    const baseAsset = market.split("_")[0];
    const quoteAsset = market.split("_")[1];
    if (!orderbook) {
      throw new Error("No orderBook found for this ticker");
    }
  }

  // quoteAsset means that we're giving . Base asset what we're thinking of buying.
  /**
   *
   * @param baseAsset "GRBL,ILI" is like a baseAsset.
   * @param quoteAsset "NRS|USD" will be the quoteAsset.
   * @param side "BUY|SELL" will be the side.
   * @param userId User that place the order.
   * @param price Price per unit.
   * @param quantity How many units to trade.
   */
  checkAndLockFunds(
    baseAsset: string,
    quoteAsset: string,
    side: Side,
    userId: string,
    price: string,
    quantity: string
  ) {
    if (side == "BUY") {
      if (
        (this.balances.get(userId)?.[quoteAsset]?.available || 0) <
        Number(quantity) * Number(price)
      ) {
        throw new Error("Insufficient Funds.");
      }
    }
  }
}
