import { createClient, type RedisClientType } from "redis";
import type { MessageToApi } from "./types/toApi";

export class RedisManager {
  private client: RedisClientType;
  private static instance: RedisManager;
  constructor() {
    this.client = createClient();
    this.client.connect();
  }
  public static getInstance() {
    if (!this.instance) {
      this.instance = new RedisManager();
    }
    return this.instance;
  }
  public pushMessageToApi(clientId: string, message: MessageToApi) {
    this.client.publish(clientId, JSON.stringify(message));
  }
}
