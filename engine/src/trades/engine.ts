import fs from "fs";
import { OrderBook, type Order } from "./orderbook";

interface UserBalance {
  available: number;
  locked: number;
}
type Balance = Record<string, UserBalance>;
/**
balances = {
    "1": {
        INR:  { available: 10000000, locked: 0 },
        TATA: { available: 10000000, locked: 0 }
    },
    "2": {
        INR:  { available: 10000000, locked: 0 },
        TATA: { available: 10000000, locked: 0 }
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
  private balances: Map<string, UserBalance> = new Map();
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
}
