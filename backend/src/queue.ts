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
}

export const providerQueue = new Queue("provider-checks", {
  connection,
  defaultJobOptions: {
    // Jobs are deduped by `check:provider:domain`. Keeping finished jobs around longer
    // would serve stale results for that id; the Redis cache in browsing.ts handles reuse.
    removeOnComplete: { age: 60 },
    removeOnFail: { age: 60 },
    attempts: 2,
    backoff: { type: "exponential", delay: 1500 },
    timeout: 60_000,
  } as JobsOptions,
});

// raise listener cap on this Queue instance
(providerQueue as any).setMaxListeners?.(1000);

export const providerEvents = new QueueEvents("provider-checks", { connection });

// Workers mostly await network/browser slots (browsers are capped by PW_CONCURRENCY),
// so pick jobs up immediately: that way a lookup's 45s timeout starts with the search
// and HTTP providers never wait behind browser jobs.
const GLOBAL_CONCURRENCY = Number(process.env.WORKER_CONCURRENCY || 50);
const WORKER_LOCK_DURATION = Number(process.env.WORKER_LOCK_DURATION_MS || 120_000);
const WORKER_STALLED_INTERVAL = Number(process.env.WORKER_STALLED_INTERVAL_MS || 30_000);

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
    // Give workers more room to renew locks if Redis has brief latency spikes.
    lockDuration: WORKER_LOCK_DURATION,
    stalledInterval: WORKER_STALLED_INTERVAL,
  }
)