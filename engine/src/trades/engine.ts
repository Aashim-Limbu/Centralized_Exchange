import fs from "fs";
import type { OrderBook } from "./orderbook";

interface UserBalance {
  available: number;
  locked: number;
}
type Balance = Record<string, UserBalance>;
export const BASE_CURRENCY = "USD";
export class Engine {
  private orderbook: OrderBook[] = [];
  private balance: Map<string, Balance> = new Map();
  constructor() {
    let snapshot = null;
    try {
      if (process.env.WITH_SNAPSHOT) {
        snapshot = fs.readFileSync("./snapshot.json");
      }
    } catch (e) {
      console.log(`Error loading the snapshot ${e}`);
    }
  }
}
