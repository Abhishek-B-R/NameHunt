import { Queue, Worker, QueueEvents, type JobsOptions } from "bullmq";
import { ProviderNames } from "./types/providerNames.js";
import { runBrowsingProvider } from "./browsing.js";
import { EventEmitter } from "node:events";
import { getRedisUrl } from "./redisConnection.js";

EventEmitter.defaultMaxListeners = 1000;

// Single connection config used everywhere
const connection = {
  url: getRedisUrl(),
  maxRetriesPerRequest: null as any,
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

// raise listener cap on this Queue instance
(providerQueue as any).setMaxListeners?.(1000);

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