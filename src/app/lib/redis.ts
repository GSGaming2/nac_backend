import { createClient } from "redis";

export const redis = createClient({ url: process.env.REDIS_URL });

redis.on("error", (err) => console.error("Redis error", err));

// Connect once (Node runtime)
if (!redis.isOpen) {
  await redis.connect();
}