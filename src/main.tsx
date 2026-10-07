import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register PWA service worker safely in production, unregister stale workers in development
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    try {
      registerSW({ immediate: true });
    } catch (e) {
      // Service workers may be disabled in restricted iframe sandboxes
    }
  } else {
    // In development mode, unregister any stale dev service workers to prevent cached chunk errors
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    }).catch(() => {});
  }
}

// Circular structure safety defense for JSON.stringify in ES modules
(function () {
  const origStringify = JSON.stringify;
  JSON.stringify = function (value: any, replacer?: any, space?: any): string {
    try {
      const seen = new WeakSet();
      return origStringify.call(
        JSON,
        value,
        function (this: any, k: string, v: any) {
          if (typeof v === 'object' && v !== null) {
            if (seen.has(v)) {
              return '[Circular]';
            }
            seen.add(v);
          }
          if (typeof replacer === 'function') {
            return replacer.call(this, k, v);
          }
          return v;
        },
        space
      );
    } catch {
      try {
        return origStringify.call(JSON, String(value));
      } catch {
        return '"[Unserializable]"';
      }
    }
  };
})();

// Google Maps Quota Defense & suppress WebSocket / HMR logs in iframe
(window as any).gm_authFailure = () => {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
};

const origError = console.error;
const origWarn = console.warn;

function sanitizeLogArg(arg: unknown): unknown {
  if (arg === null || typeof arg !== 'object') {
    return arg;
  }
  if (arg instanceof Error) {
    return `${arg.name}: ${arg.message}\n${arg.stack || ''}`;
  }
  try {
    // Test if cleanly serializable without throwing circular reference errors
    JSON.stringify(arg);
    return arg;
  } catch {
    return String(arg);
  }
}

console.error = (...args: unknown[]) => {
  const msg = args.map((a) => String(a)).join(' ');
  // Ignore Vite HMR / WebSocket errors as per runtime environment constraints
  if (
    msg.includes('WebSocket') ||
    msg.includes('[vite]') ||
    msg.includes('failed to connect to websocket') ||
    msg.includes('server connection lost')
  ) {
    return;
  }
  const safeArgs = args.map(sanitizeLogArg);
  origError.apply(console, safeArgs);
  if (msg.includes('OverQuotaMapError') || msg.includes('QuotaExceededError')) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
};

console.warn = (...args: unknown[]) => {
  const msg = args.map((a) => String(a)).join(' ');
  if (
    msg.includes('WebSocket') ||
    msg.includes('[vite]') ||
    msg.includes('failed to connect to websocket') ||
    msg.includes('server connection lost')
  ) {
    return;
  }
  const safeArgs = args.map(sanitizeLogArg);
  origWarn.apply(console, safeArgs);
};

// Notify loader that React bundle loaded and is mounting
if (typeof window !== 'undefined' && (window as any).__appLoader) {
  (window as any).__appLoader.setProgress(55, 'Mounting application interface...');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
