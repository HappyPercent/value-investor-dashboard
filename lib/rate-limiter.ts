/**
 * Runs fn for each item, waiting at least delayMs between the *start* of each call.
 * If fn takes longer than delayMs, the next call starts immediately.
 */
export async function batchWithDelay<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  delayMs: number
): Promise<Array<{ item: T; result: R | null; error: string | null }>> {
  const results: Array<{ item: T; result: R | null; error: string | null }> = [];

  for (const item of items) {
    const start = Date.now();
    try {
      const result = await fn(item);
      results.push({ item, result, error: null });
    } catch (e) {
      results.push({ item, result: null, error: String(e) });
    }
    const elapsed = Date.now() - start;
    const remaining = delayMs - elapsed;
    if (remaining > 0) {
      await new Promise((r) => setTimeout(r, remaining));
    }
  }

  return results;
}

export const delay = (ms: number) =>
  new Promise<void>((r) => setTimeout(r, ms));
