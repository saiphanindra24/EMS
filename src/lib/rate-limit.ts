// ---------------------------------------------------------------------------
// In-memory rate limiter for API routes.
//
// Uses a sliding window approach. Each key (typically an IP address) is
// allowed `maxRequests` within `windowMs` milliseconds. Entries are
// automatically cleaned up to prevent unbounded memory growth.
//
// NOTE: This is per-process. If you scale to multiple server instances,
// switch to a Redis-backed limiter (e.g., `@upstash/ratelimit`).
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  timestamps: number[];
}

interface RateLimiterOptions {
  /** Time window in milliseconds. */
  windowMs: number;
  /** Maximum requests allowed within the window. */
  maxRequests: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

function getStore(name: string): Map<string, RateLimitEntry> {
  let store = stores.get(name);
  if (!store) {
    store = new Map();
    stores.set(name, store);
  }
  return store;
}

/**
 * Create a named rate limiter. Returns a function that checks whether a
 * given key (usually an IP) should be allowed or blocked.
 */
export function createRateLimiter(name: string, options: RateLimiterOptions) {
  const store = getStore(name);
  const { windowMs, maxRequests } = options;

  // Periodic cleanup every 60 seconds to prevent memory leaks
  if (typeof globalThis !== "undefined") {
    const cleanupKey = `__rateLimitCleanup_${name}`;
    const g = globalThis as Record<string, unknown>;
    if (!g[cleanupKey]) {
      g[cleanupKey] = setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of store) {
          entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
          if (entry.timestamps.length === 0) store.delete(key);
        }
      }, 60_000);
    }
  }

  return {
    /**
     * Check if the request should be allowed.
     * @returns `{ allowed: true }` or `{ allowed: false, retryAfterMs }`.
     */
    check(key: string): { allowed: true } | { allowed: false; retryAfterMs: number } {
      const now = Date.now();
      let entry = store.get(key);

      if (!entry) {
        entry = { timestamps: [] };
        store.set(key, entry);
      }

      // Remove timestamps outside the window
      entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

      if (entry.timestamps.length >= maxRequests) {
        const oldestInWindow = entry.timestamps[0]!;
        const retryAfterMs = windowMs - (now - oldestInWindow);
        return { allowed: false, retryAfterMs };
      }

      entry.timestamps.push(now);
      return { allowed: true };
    },

    /** Reset the limiter for a specific key (e.g., after successful login). */
    reset(key: string) {
      store.delete(key);
    },
  };
}

// ---------------------------------------------------------------------------
// Pre-configured limiters for auth endpoints
// ---------------------------------------------------------------------------

/** Login: 5 attempts per 15 minutes per IP. */
export const loginLimiter = createRateLimiter("login", {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
});

/** Registration: 3 requests per 15 minutes per IP. */
export const registerLimiter = createRateLimiter("register", {
  windowMs: 15 * 60 * 1000,
  maxRequests: 3,
});

/** General API: 100 requests per minute per IP. */
export const apiLimiter = createRateLimiter("api", {
  windowMs: 60 * 1000,
  maxRequests: 100,
});
