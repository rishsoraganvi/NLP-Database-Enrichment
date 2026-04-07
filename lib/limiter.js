// lib/limiter.js
// Simple in-memory rate limiter: max N requests per IP per window

const store = new Map(); // ip -> { count, resetAt }

export function checkRateLimit(ip) {
  const MAX = parseInt(process.env.RATE_LIMIT_MAX || "10");
  const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000");
  const now = Date.now();

  if (!store.has(ip)) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  const entry = store.get(ip);
  if (now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= MAX) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count++;
  return { allowed: true };
}
