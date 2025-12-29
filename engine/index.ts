import { Engine } from "./src/trades/engine";
import { OrderBook, type Side } from "./src/trades/orderbook";

const engine = new Engine();

function addBTCUSDOrderBook() {
  const btcUsdOrderBook = new OrderBook("BTC", [], [], 0, 0);
  console.log("✓ Created BTC_USD orderbook");
  return btcUsdOrderBook;
}

function testAddOrder(
  orderBook: OrderBook,
  side: Side,
  price: number,
  qty: number,
  userId: string
) {
  const orderId = crypto.randomUUID();
  const order = {
    orderId,
    side,
    price,
    quantity: qty,
    filled: 0,
    userId,
  };

  console.log(`\n📝 Adding ${side} order:`);
  console.log(`   Price: $${price}, Qty: ${qty}, User: ${userId}`);

  const { fills, executedQty } = orderBook.addOrder(order);

  console.log(`   Executed Qty: ${executedQty}/${qty}`);
  if (fills.length > 0) {
    console.log(`   Fills: ${fills.length}`);
    fills.forEach((fill, idx) => {
      console.log(
        `     Fill ${idx + 1}: ${fill.qty} @ $${fill.price} (Trade ID: ${
          fill.tradeId
        })`
      );
    });
  }

  return { orderId, fills, executedQty };
}

function getDepth(orderBook: OrderBook) {
  console.log("\n📊 Order Book Depth:");
  console.log(`   Bids: ${orderBook.bids.length} orders`);
  orderBook.bids.forEach((bid) => {
    const remaining = bid.quantity - bid.filled;
    console.log(
      `     ${bid.quantity} @ $${bid.price} (Filled: ${bid.filled}, Remaining: ${remaining})`
    );
  });

  console.log(`   Asks: ${orderBook.asks.length} orders`);
  orderBook.asks.forEach((ask) => {
    const remaining = ask.quantity - ask.filled;
    console.log(
      `     ${ask.quantity} @ $${ask.price} (Filled: ${ask.filled}, Remaining: ${remaining})`
    );
  });

  console.log(`   Current Price: $${orderBook.currentPrice}`);
}

async function main() {
  console.log("🚀 Starting Exchange Engine Test\n");

  // Create BTC_USD orderbook
  const btcUsd = addBTCUSDOrderBook();

  // Test: Add BUY orders
  console.log("\n--- Test 1: Add BUY Orders ---");
  testAddOrder(btcUsd, "BUY", 45000, 0.5, "user1");
  testAddOrder(btcUsd, "BUY", 44900, 0.3, "user2");
  testAddOrder(btcUsd, "BUY", 44800, 0.2, "user3");
  getDepth(btcUsd);

  // Test: Add SELL orders (should match with BUY orders)
  console.log("\n--- Test 2: Add SELL Orders (with matches) ---");
  testAddOrder(btcUsd, "SELL", 44900, 0.4, "user4");
  getDepth(btcUsd);

  testAddOrder(btcUsd, "SELL", 44700, 0.5, "user5");
  getDepth(btcUsd);

  // Test: Add more BUY orders
  console.log("\n--- Test 3: Add More BUY Orders ---");
  testAddOrder(btcUsd, "BUY", 44600, 0.1, "user6");
  getDepth(btcUsd);

  console.log(
    "\n✅ Test complete - Add your breakpoints and re-run to debug flow\n"
  );
}

main().catch(console.error);
