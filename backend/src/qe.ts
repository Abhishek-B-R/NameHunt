import { QueueEvents } from "bullmq";
import { getRedisUrl } from "./redisConnection.js";

export function createRequestQueueEvents(queueName: string) {
  const qe = new QueueEvents(queueName, {
    connection: {
      url: getRedisUrl(),
      // BullMQ/ioredis stability flags
      maxRetriesPerRequest: null as any,
      enableReadyCheck: false,
    },
  });
  qe.setMaxListeners(1000);
  return qe;
}