export function getRedisUrl() {
  return (
    process.env.REDIS_URL ||
    // fallback for local non-docker dev
    `redis://${process.env.REDIS_HOST || "localhost"}:${
      process.env.REDIS_PORT || "6379"
    }`
  );
}