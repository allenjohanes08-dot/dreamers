// src/lib/api.ts

export class APIError extends Error {
  constructor(public message: string, public status?: number, public operation?: string) {
    super(message);
    this.name = 'APIError';
  }
}

interface CacheItem<T> {
  data: T;
  expiry: number;
}

// Lightweight, zero-overhead in-memory cache and in-flight request deduplicator
class APICacheManager {
  private cache = new Map<string, CacheItem<any>>();
  private inFlight = new Map<string, Promise<Response>>();

  public get(key: string): any | null {
    const item = this.cache.get(key);
    if (item && item.expiry > Date.now()) {
      return item.data;
    }
    if (item) {
      this.cache.delete(key);
    }
    return null;
  }

  public set(key: string, data: any, ttlMs: number) {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlMs,
    });
  }

  public getInFlight(key: string): Promise<Response> | undefined {
    return this.inFlight.get(key);
  }

  public setInFlight(key: string, promise: Promise<Response>) {
    this.inFlight.set(key, promise);
  }

  public deleteInFlight(key: string) {
    this.inFlight.delete(key);
  }

  public clear() {
    this.cache.clear();
    this.inFlight.clear();
  }
}

export const apiCache = new APICacheManager();

/**
 * Safely parse JSON from a fetch Response, falling back to a default value if invalid or empty.
 */
export async function safeJson<T = any>(res: Response, fallback?: T): Promise<T> {
  try {
    return await res.json();
  } catch {
    return (fallback !== undefined ? fallback : ({} as any)) as T;
  }
}

/**
 * Low-latency fetch with automatic in-flight deduplication, smart caching, and exponential backoff retry.
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit & { _skipCache?: boolean; operationName?: string },
  retries = 2,
  delay = 600
): Promise<Response> {
  const method = options?.method ? options.method.toUpperCase() : 'GET';
  const isGet = method === 'GET';
  const cacheKey = `${method}:${url}`;

  // 1. Check client-side memory cache for public, cache-safe GET endpoints
  const isPublicCacheable = isGet && !options?._skipCache && (
    url.includes('/api/products') || 
    url.includes('/api/categories') || 
    url.includes('/api/settings') ||
    url.includes('/api/payments/methods')
  );

  if (isPublicCacheable) {
    const cachedData = apiCache.get(cacheKey);
    if (cachedData !== null) {
      return new Response(JSON.stringify(cachedData), {
        status: 200,
        statusText: 'OK (Cached)',
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Request deduplication: join in-flight request if already running
    const existingInFlight = apiCache.getInFlight(cacheKey);
    if (existingInFlight) {
      const res = await existingInFlight;
      return res.clone();
    }
  }

  const opts: RequestInit = { ...options };
  delete (opts as any)._skipCache;
  delete (opts as any).operationName;
  const operationName = options?.operationName || 'Operation';

  // Sanitize authorization headers to prevent invalid requests
  if (opts.headers) {
    if (opts.headers instanceof Headers) {
      const auth = opts.headers.get('Authorization');
      if (auth && (auth === 'Bearer undefined' || auth === 'Bearer null' || auth.trim() === 'Bearer')) {
        opts.headers.delete('Authorization');
      }
    } else if (typeof opts.headers === 'object' && !Array.isArray(opts.headers)) {
      const headersRecord = { ...(opts.headers as Record<string, string>) };
      const auth = headersRecord['Authorization'] || headersRecord['authorization'];
      if (auth && (auth === 'Bearer undefined' || auth === 'Bearer null' || auth.trim() === 'Bearer')) {
        delete headersRecord['Authorization'];
        delete headersRecord['authorization'];
      }
      opts.headers = headersRecord;
    }
  }

  // Execute request with abort timeout safety
  const executeFetch = async (): Promise<Response> => {
    let timeoutId: any;
    let signal = opts.signal;

    if (!signal && typeof AbortController !== 'undefined') {
      const controller = new AbortController();
      // 15s timeout for fast responsiveness without freezing
      timeoutId = setTimeout(() => controller.abort(), 15000);
      signal = controller.signal;
    }

    try {
      const res = await fetch(url, { ...opts, signal });
      if (timeoutId) clearTimeout(timeoutId);

      // Cache successful response data if cacheable
      if (isPublicCacheable && res.ok) {
        try {
          const cloned = res.clone();
          const data = await cloned.json();
          apiCache.set(cacheKey, data, 30000); // 30s TTL
        } catch (e) {}
      }

      // Retry on 5xx server errors with backoff
      if (!res.ok && res.status >= 500 && retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        return fetchWithRetry(url, options, retries - 1, delay * 1.5);
      }

      if (!res.ok) {
        throw new APIError(`${operationName} failed`, res.status, operationName);
      }

      return res;
    } catch (err: any) {
      if (timeoutId) clearTimeout(timeoutId);

      if (opts.signal?.aborted || err?.name === 'AbortError') {
        throw err;
      }

      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        return fetchWithRetry(url, options, retries - 1, delay * 1.5);
      }

      if (err instanceof APIError) {
        throw err;
      }

      throw new APIError(`Connection temporarily unavailable for ${operationName}. Please retry.`, 503, operationName);
    } finally {
      if (isPublicCacheable) {
        apiCache.deleteInFlight(cacheKey);
      }
    }
  };

  const fetchPromise = executeFetch();
  if (isPublicCacheable) {
    apiCache.setInFlight(cacheKey, fetchPromise);
  }

  return await fetchPromise;
}

export async function fetchCached(url: string, options?: RequestInit, ttlMs = 30000): Promise<Response> {
  return fetchWithRetry(url, options);
}
