/**
 * Transient upstream failures worth retrying: rate limits (429) and server/overload
 * errors (500/502/503/529, "overloaded", "high demand"). Auth/validation errors
 * (e.g. 401 invalid key, 400 bad request) are NOT retryable and surface immediately.
 */
export function isRetryableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b(429|500|502|503|529)\b/.test(msg)
    || /too many requests|overloaded|service unavailable|rate limit|high demand|temporarily/i.test(msg);
}

/**
 * Runs `fn`, retrying transient failures with capped exponential backoff. Kept short
 * (2 retries, ≤3s delay) so a single verification stays within the ~5s latency target.
 * `sleep` is injectable so tests can run without real delays.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  baseDelayMs = 600,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !isRetryableError(err)) throw err;
      const delay = Math.min(baseDelayMs * 2 ** attempt, 3000);
      console.warn(
        `Provider call failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms:`,
        err instanceof Error ? err.message : err
      );
      await sleep(delay);
    }
  }
  throw lastErr;
}
