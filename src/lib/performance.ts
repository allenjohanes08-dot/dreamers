// src/lib/performance.ts
import { apiCache } from './api.ts';

class PerformanceManager {
  private metrics = {
    apiCalls: 0,
    cacheHits: 0,
    cacheMisses: 0,
    errors: 0,
    retries: 0,
  };

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.debug('[Performance] Network connection restored.');
      });
      window.addEventListener('offline', () => {
        console.warn('[Performance] Network connection lost. Operating in offline resilience mode.');
      });
    }
  }

  public isOnline(): boolean {
    if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
      return navigator.onLine;
    }
    return true;
  }

  public getNetworkCondition(): 'fast' | 'slow' | 'offline' {
    if (!this.isOnline()) return 'offline';
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (conn) {
      if (conn.saveData || conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g' || conn.effectiveType === '3g') {
        return 'slow';
      }
    }
    return 'fast';
  }

  public clearCache() {
    apiCache.clear();
  }

  public getMetrics() {
    return { ...this.metrics };
  }
}

export const perfManager = new PerformanceManager();
