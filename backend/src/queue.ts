// queue.ts
import { Queue, Worker, QueueEvents, type JobsOptions } from "bullmq";
import { ProviderNames } from "./types/providerNames.js";
import { runBrowsingProvider } from "./browsing.js";

// Use BullMQ connection options object. Do NOT construct ioredis yourself here.
const connection = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT || 6379),
  username: process.env.REDIS_USERNAME || undefined,
  password: process.env.REDIS_PASSWORD || undefined,
  db: Number(process.env.REDIS_DB || 0),

  // Required by BullMQ when using blocking connections:
  maxRetriesPerRequest: null as unknown as null,
  enableReadyCheck: false,
};

export const providerQueue = new Queue("provider-checks", {
  connection,
  defaultJobOptions: {
    removeOnComplete: 1000,
    removeOnFail: 1000,
    attempts: 2,
    backoff: { type: "exponential", delay: 1500 },
    timeout: 60_000,
  } as JobsOptions,
});

export const providerEvents = new QueueEvents("provider-checks", { connection });

const GLOBAL_CONCURRENCY = Number(process.env.WORKER_CONCURRENCY || 8);

export const providerWorker = new Worker(
  "provider-checks",
  async (job) => {
    const { provider, domain, timeoutMs } = job.data as {
      provider: ProviderNames;
      domain: string;
      timeoutMs?: number;
    };
    return await runBrowsingProvider(provider, domain, { timeoutMs });
  },
  {
    connection,
    concurrency: GLOBAL_CONCURRENCY,
  }
);