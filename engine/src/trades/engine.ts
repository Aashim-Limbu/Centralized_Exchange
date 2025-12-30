import fs from "fs";
import { OrderBook, type Fill, type Order, type Side } from "./orderbook";
import { CANCEL_ORDER, ON_RAMP, type MessageFromApi } from "../types/fromApi";
import { CREATE_ORDER, GET_DEPTH } from "../types/toApi";
import { RedisManager } from "../RedisManager";
import { availableMemory } from "process";

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
        HRL:  { available: 100, locked: 0 },
        USD: { available: 10000000, locked: 0 }
    },
    "2": {
        GRBL:  { available: 200, locked: 0 },
        USD: { available: 10000000, locked: 0 }
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
  process({ message, clientId }: ProcessProps) {
    switch (message.type) {
      case CREATE_ORDER:
        try {
          const data = this.createOrder(
            message.data.market,
            message.data.price,
            message.data.quantity,
            message.data.side,
            message.data.userId
          );
          // publishing the message to the api [the subscriber]
          RedisManager.getInstance().pushMessageToApi(clientId, {
            type: "ORDER_PLACED",
            payload: {
              orderId: data.orderId,
              executedQty: data.executedQty,
              fills: data.fills,
            },
          });
        } catch (error) {
          console.error(`Error`, error);
          RedisManager.getInstance().pushMessageToApi(clientId, {
            type: "ORDER_CANCELLED",
            payload: {
              orderId: "",
              executedQty: 0,
              remainingQty: 0,
            },
          });
        }
        break;
      case CANCEL_ORDER:
        try {
          const { market: marketToCancel, orderId } = message.data;
          const orderBook = this.orderbooks.find(
            (o) => o.ticker() === marketToCancel
          );
          if (!orderBook) {
            throw new Error("No orderbook found");
          }
          const baseAsset = marketToCancel.split("-")[0]!;
          const quoteAsset = marketToCancel.split("-")[1]!;
          const userOrder =
            orderBook.asks.find((o) => o.orderId === orderId) ||
            orderBook.bids.find((o) => o.orderId === orderId);
          if (!userOrder) {
            throw new Error(`No order found with id: ${orderId}`);
          }
          const userBalance = this.getOrCreateUserBalance(
            userOrder.userId,
            quoteAsset,
            baseAsset
          );
          const unfilledQty = userOrder.quantity - userOrder.filled;
          if (userOrder.side === "BUY") {
            // release the quote asset from locked (using original locked price).
            orderBook.cancelBid(userOrder);
            const lockedAmount = unfilledQty * userOrder.price;
            userBalance[quoteAsset]!.available += lockedAmount;
            userBalance[quoteAsset]!.locked -= lockedAmount;
          } else {
            // release the base asset from locked.
            orderBook.cancelAsk(userOrder);
            userBalance[baseAsset]!.available += unfilledQty;
            userBalance[baseAsset]!.locked -= unfilledQty;
          }
          RedisManager.getInstance().pushMessageToApi(clientId, {
            type: "ORDER_CANCELLED",
            payload: {
              orderId,
              executedQty: userOrder.filled,
              remainingQty: unfilledQty,
            },
          });
        } catch (error) {
          console.log("===Error while canceling the order===");
          console.error(error);
          RedisManager.getInstance().pushMessageToApi(clientId, {
            type: "ORDER_CANCELLED",
            payload: {
              orderId: "",
              executedQty: 0,
              remainingQty: 0,
            },
          });
        }
        break;
      case ON_RAMP:
        const { amount, userId } = message.data;
        this.onRamp(userId, Number(amount));
        break;
      case GET_DEPTH:
        // query user's active order
        try {
          const { market } = message.data;
          const orderBook = this.orderbooks.find((o) => o.ticker() === market);
          if (!orderBook) {
            throw new Error("No orderBook found");
          }
          // RedisManager.getInstance().pushMessageToApi(clientId,{
          //     type:"DEPTH",
          //     payload: orderBook
          // })
        } catch (error) {}
        break;
      default:
        break;
    }
  }
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

    if (!orderbook || !baseAsset || !quoteAsset) {
      throw new Error(
        "Invalid market pair - orderbook or asset pair does not exist"
      );
    }
    this.checkAndLockFunds(
      baseAsset,
      quoteAsset,
      side,
      userId,
      price,
      quantity
    );

    const order: Order = {
      price: Number(price),
      quantity: Number(quantity),
      side,
      userId,
      filled: 0,
      orderId: crypto.randomUUID(),
    };
    const { fills, executedQty } = orderbook.addOrder(order);
    this.updateBalance(
      userId,
      baseAsset,
      quoteAsset,
      side,
      fills,
      executedQty,
      Number(price),
      Number(quantity)
    );
    return { executedQty, fills, orderId: order.orderId };
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
    // From user perspective . They buy the baseAsset thus requies the quoteAsset in their balance
    const userBalance = this.getOrCreateUserBalance(
      userId,
      quoteAsset,
      baseAsset
    );
    if (side == "BUY") {
      const requiredAmount = Number(price) * Number(quantity);
      if (
        !userBalance[quoteAsset] ||
        userBalance[quoteAsset].available < requiredAmount
      ) {
        throw new Error("Insufficient Funds.");
      }

      userBalance[quoteAsset].available -= requiredAmount;
      userBalance[quoteAsset].locked += requiredAmount;
    } else {
      // For SELL orders, lock the base asset being sold
      const requiredAmount = Number(quantity);
      if (
        !userBalance[baseAsset] ||
        userBalance[baseAsset].available < requiredAmount
      ) {
        throw new Error("Insufficient base asset balance for this sell order");
      }
      userBalance[baseAsset].available -= requiredAmount;
      userBalance[baseAsset].locked += requiredAmount;
    }
  }
  private getOrCreateUserBalance(
    userId: string,
    quoteAsset: string,
    baseAsset: string
  ) {
    if (!this.balances.has(userId)) {
      this.balances.set(userId, {});
    }

    const userBalance = this.balances.get(userId)!;

    if (!userBalance[quoteAsset]) {
      userBalance[quoteAsset] = { available: 0, locked: 0 };
    }

    if (!userBalance[baseAsset]) {
      userBalance[baseAsset] = { available: 0, locked: 0 };
    }

    return userBalance;
  }
  /**
   * @dev when updating the balances never touch the available balance directly. If it was a BUY order , the other user already subtracted from the available during the lock phase.
   * @dev when there is SELL order, The user already subtracted from available lock phase.
   */
  private updateBalance(
    userId: string,
    baseAsset: string,
    quoteAsset: string,
    side: Side,
    fills: Fill[],
    executedQty: number,
    originalPrice: number,
    originalQuantity: number
  ) {
    const userBalance = this.getOrCreateUserBalance(
      userId,
      quoteAsset,
      baseAsset
    );
    if (side == "BUY") {
      let totalSpent = 0;
      fills.forEach((fill) => {
        const otherUserBalance = this.getOrCreateUserBalance(
          fill.otherUserId,
          quoteAsset,
          baseAsset
        );
        const filledAmount = fill.price * fill.qty;
        totalSpent += filledAmount;
        otherUserBalance[quoteAsset]!.available += filledAmount; //MM receives money
        otherUserBalance[baseAsset]!.locked -= fill.qty; // Unlock the seller's baseAsset [nullify the locked asset of the MM]
        userBalance[baseAsset]!.available += fill.qty; //Buyer receives asset
      });
      // Unlock at the buyers best price and returns the remaining.
      const totalLocked = Number(originalPrice) * Number(originalQuantity);
      userBalance[quoteAsset]!.locked -= totalLocked;
      const refundAmount = totalLocked - totalSpent;
      userBalance[quoteAsset]!.available += refundAmount;
    } else {
      let totalRecieved = 0;
      fills.forEach((fill) => {
        const otherBalance = this.getOrCreateUserBalance(
          fill.otherUserId,
          quoteAsset,
          baseAsset
        );
        const fillAmount = fill.price * fill.qty;
        totalRecieved += fillAmount;
        userBalance[quoteAsset]!.available += fillAmount; //Seller receives money.
        otherBalance[quoteAsset]!.locked -= fillAmount; // Unlock buyer's money.
        otherBalance[baseAsset]!.available += fill.qty; // Buyer receives asset.
      });
      // Unlock all originally locked quantity
      userBalance[baseAsset]!.locked -= originalQuantity;
      const unfilledQty = Number(originalQuantity) - executedQty;
      // Return unfilled quantity to available
      userBalance[baseAsset]!.available += unfilledQty;
    }
  }
  private onRamp(userId: string, amount: number) {
    const userBalance = this.balances.get(userId);
    if (!userBalance) {
      this.balances.set(userId, {
        [BASE_CURRENCY]: {
          available: amount,
          locked: 0,
        },
      });
    } else {
      userBalance[BASE_CURRENCY]!.available += amount;
    }
  }
}
