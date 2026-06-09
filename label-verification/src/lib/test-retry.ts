import { isRetryableError, withRetry } from "./retry";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
  console.log(`[PASS] ${message}`);
}

const noSleep = async () => {}; // skip real backoff delays in tests

async function run() {
  console.log("\n--- Testing isRetryableError ---");
  assert(isRetryableError(new Error("[503 Service Unavailable] high demand")), "503 is retryable");
  assert(isRetryableError(new Error("[429 Too Many Requests] rate limit")), "429 is retryable");
  assert(isRetryableError(new Error("Claude API Error: 529 - overloaded")), "529/overloaded is retryable");
  assert(!isRetryableError(new Error("Claude API Error: 401 - invalid x-api-key")), "401 is NOT retryable");
  assert(!isRetryableError(new Error("400 Bad Request: image required")), "400 is NOT retryable");

  console.log("\n--- Testing withRetry ---");

  // Succeeds on the 2nd attempt after one transient 503
  let calls = 0;
  const result = await withRetry(async () => {
    calls++;
    if (calls < 2) throw new Error("[503 Service Unavailable]");
    return "ok";
  }, 2, 1, noSleep);
  assert(result === "ok" && calls === 2, "Retries a transient 503 and succeeds on attempt 2");

  // Does NOT retry a non-retryable 401 — fails immediately after 1 call
  let authCalls = 0;
  let threw = false;
  try {
    await withRetry(async () => {
      authCalls++;
      throw new Error("Claude API Error: 401 - invalid x-api-key");
    }, 2, 1, noSleep);
  } catch {
    threw = true;
  }
  assert(threw && authCalls === 1, "Does not retry a 401 (fails after a single attempt)");

  // Gives up after retries are exhausted (3 total attempts for retries=2)
  let persistentCalls = 0;
  let gaveUp = false;
  try {
    await withRetry(async () => {
      persistentCalls++;
      throw new Error("[503 Service Unavailable]");
    }, 2, 1, noSleep);
  } catch {
    gaveUp = true;
  }
  assert(gaveUp && persistentCalls === 3, "Gives up after retries exhausted (1 + 2 retries = 3 attempts)");
}

run()
  .then(() => console.log("\n[SUCCESS] All retry tests passed successfully!\n"))
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`\n[FAIL] Retry test suite failed: ${message}\n`);
    process.exit(1);
  });
