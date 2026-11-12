interface CacheEntry<T> {
  expiresAt: number
  value: T
}

const responseCache = new Map<string, CacheEntry<unknown>>()
const inflightRequests = new Map<string, Promise<unknown>>()

/**
 * Deduplicates concurrent identical requests and caches resolved values for `ttlMs`.
 */
export async function dedupedCachedFetch<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const now = Date.now()
  const cached = responseCache.get(key) as CacheEntry<T> | undefined
  if (cached && cached.expiresAt > now) {
    return cached.value
  }

  const inflight = inflightRequests.get(key) as Promise<T> | undefined
  if (inflight) {
    return inflight
  }

  const promise = fetcher()
    .then((value) => {
      responseCache.set(key, { value, expiresAt: Date.now() + ttlMs })
      return value
    })
    .finally(() => {
      inflightRequests.delete(key)
    })

  inflightRequests.set(key, promise)
  return promise
}

export function invalidateRequestCache(prefix?: string): void {
  if (!prefix) {
    responseCache.clear()
    return
  }
  for (const key of responseCache.keys()) {
    if (key.startsWith(prefix)) {
      responseCache.delete(key)
    }
  }
}

