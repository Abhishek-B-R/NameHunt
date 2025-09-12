import { QueueEvents, type Job } from "bullmq";

// Reuse the same connection options you pass to Queue/Worker
const connection = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT || 6379),
  username: process.env.REDIS_USERNAME || undefined,
  password: process.env.REDIS_PASSWORD || undefined,
  db: Number(process.env.REDIS_DB || 0),
  maxRetriesPerRequest: null as unknown as null,
  enableReadyCheck: false,
};

export async function waitJob<T = any>(job: Job, timeoutMs: number): Promise<T> {
  const qe = new QueueEvents(job.queueName, { connection });
  try {
    await qe.waitUntilReady();
    // pass the qe so BullMQ can listen safely
    return (await job.waitUntilFinished(qe, timeoutMs)) as T;
  } finally {
    await qe.close().catch(() => {});
  }
}