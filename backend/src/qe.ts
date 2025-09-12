import { QueueEvents } from "bullmq";

export function createRequestQueueEvents(queueName: string) {
  const connection = {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT || 6379),
    username: process.env.REDIS_USERNAME || undefined,
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number(process.env.REDIS_DB || 0),
    maxRetriesPerRequest: null as unknown as null,
    enableReadyCheck: false,
  };
  const qe = new QueueEvents(queueName, { connection });
  qe.setMaxListeners(1000);
  return qe;
}