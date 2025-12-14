import { createClient, type RedisClientType } from "redis";
import type { MessageFromOrderbook, MessageToEngine } from "./types";

export class RedisManager {
  private client: RedisClientType;
  private publisher: RedisClientType;
  private static instance: RedisManager;
  private constructor() {
    this.client = createClient();
    this.client.connect();
    this.publisher = createClient();
    this.publisher.connect();
  }
  public static getInstance() {
    if (!this.instance) {
      this.instance = new RedisManager();
    }
    return this.instance;
  }
  public sendAndAwait(message: MessageToEngine) {
    return new Promise<MessageFromOrderbook>((resolve) => {
      const id = this.getRandomClient();
      // Redis pub sub for asynchronous backend communication. Recieve message from the orderBook
      this.client.subscribe(id, (message) => {
        this.client.unsubscribe(id);
        resolve(JSON.parse(message));
      });
      // Redis queue. Put message in queue. Message being type createOrder,cancelOrder,OnRamp
      this.publisher.lPush(
        "messsages",
        JSON.stringify({ clientId: id, message })
      );
    });
  }
  public getRandomClient() {
    return crypto.randomUUID();
  }
}
