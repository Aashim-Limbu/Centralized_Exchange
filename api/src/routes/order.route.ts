import { Router } from "express";
import { RedisManager } from "../RedisManager";
import { CANCEL_ORDER, CREATE_ORDER, GET_OPEN_ORDERS } from "../types";

const orderRouter = Router();
// BaseURL: /api/v1/order
orderRouter.post("/", async (req, res) => {
  const { market, price, quantity, side, userId } = req.body;
  const response = await RedisManager.getInstance().sendAndAwait({
    type: CREATE_ORDER,
    data: {
      market,
      price,
      quantity,
      side,
      userId,
    },
  });
  res.status(400).json({
    status: "success",
    message: response.payload,
  });
});

orderRouter.delete("/", async (req, res) => {
  const { orderId, market } = req.body;
  const response = await RedisManager.getInstance().sendAndAwait({
    type: CANCEL_ORDER,
    data: {
      orderId,
      market,
    },
  });
  res.status(200).json({
    status: "success",
    message: "Order cancelled success",
  });
});

orderRouter.get("/open", async (req, res) => {
  const { userId, market } = req.body;
  if (!userId || !market) {
    return res.status(400).json({
      status: "Failed",
      message: "Insufficient Params.",
    });
  }
  const response = await RedisManager.getInstance().sendAndAwait({
    type: GET_OPEN_ORDERS,
    data: {
      userId,
      market,
    },
  });
  return res.status(200).json({
    status: "success",
    message: response.payload,
  });
});
export default orderRouter;
