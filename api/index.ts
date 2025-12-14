import express from "express";
import orderRouter from "./src/routes/order.route";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/v1/order", orderRouter);

app.listen(8080, () => {
  console.log("Server is listening to port: 8080");
});
