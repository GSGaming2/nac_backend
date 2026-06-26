import { createClient } from "redis";

const globalForRedis = globalThis as {
  redis?: ReturnType<typeof createClient>;
};

export const redis =
  globalForRedis.redis ??
  createClient({
    url: process.env.REDIS_URL,
  });

if (!globalForRedis.redis) {
  redis.on("error", (err) => {
    console.error("Redis Error:", err);
  });

  await redis.connect();

  globalForRedis.redis = redis;
}