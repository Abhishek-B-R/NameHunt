import { QueueEvents, type Job } from "bullmq";
import { getRedisUrl } from "./redisConnection.js";

const qeConnection = {
  url: getRedisUrl(),
  maxRetriesPerRequest: null as any,
  enableReadyCheck: false,
};

export async function waitJob<T = any>(
  job: Job,
  timeoutMs: number
): Promise<T> {
  const qe = new QueueEvents(job.queueName, { connection: qeConnection });
  try {
    await qe.waitUntilReady();
    return (await job.waitUntilFinished(qe, timeoutMs)) as T;
  } finally {
    await qe.close().catch(() => {});
  }
}