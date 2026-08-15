import { EventEmitter } from "events";
import { Redis } from "ioredis";

const localEventEmitter = new EventEmitter();
localEventEmitter.setMaxListeners(100);

let publisher: Redis | null = null;
let subscriber: Redis | null = null;
let isRedisAvailable = false;

// Attempt to connect to local/cloud Redis if REDIS_URL environment variable exists
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

try {
  const pub = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null, // Don't block if Redis server is offline
  });

  pub
    .connect()
    .then(() => {
      publisher = pub;
      const sub = pub.duplicate();
      sub.connect().then(() => {
        subscriber = sub;
        isRedisAvailable = true;
        console.log("🟢 Connected to Redis Pub/Sub Event Bus");
      });
    })
    .catch(() => {
      console.log("ℹ️ Local Redis offline. Using in-memory Pub/Sub event bus fallback.");
    });
} catch {
  console.log("ℹ️ Using in-memory Pub/Sub event bus fallback.");
}

export async function publishSessionEvent(code: string, eventType: string, payload: any) {
  const channel = `squadmap:session:${code.toUpperCase()}`;
  const message = JSON.stringify({ eventType, payload, timestamp: Date.now() });

  if (isRedisAvailable && publisher) {
    try {
      await publisher.publish(channel, message);
    } catch {
      localEventEmitter.emit(channel, message);
    }
  } else {
    localEventEmitter.emit(channel, message);
  }
}

export function subscribeToSessionEvents(code: string, onMessage: (data: any) => void) {
  const channel = `squadmap:session:${code.toUpperCase()}`;

  if (isRedisAvailable && subscriber) {
    subscriber.subscribe(channel);
    subscriber.on("message", (chan, msg) => {
      if (chan === channel) {
        try {
          onMessage(JSON.parse(msg));
        } catch (e) {
          console.error("PubSub parse error:", e);
        }
      }
    });
  } else {
    const handler = (msg: string) => {
      try {
        onMessage(JSON.parse(msg));
      } catch (e) {
        console.error("PubSub parse error:", e);
      }
    };
    localEventEmitter.on(channel, handler);
    return () => localEventEmitter.off(channel, handler);
  }
}
