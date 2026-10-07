// src/components/AutoSystemErrorDebugger.tsx
import React, { Component, ErrorInfo } from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { fadeIn } from '../lib/animations';

interface AutoDebuggerState {
  hasError: boolean;
  error: Error | null;
  reloadBlocked?: boolean;
}

export class SystemHealthErrorBoundary extends Component<
  { children: React.ReactNode },
  AutoDebuggerState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, reloadBlocked: false };
  }

  static getDerivedStateFromError(error: Error): AutoDebuggerState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App Error caught by boundary:', error, errorInfo);
    try {
      fetch('/api/system/error-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'client',
          type: error.name || 'ReactErrorBoundary',
          message: error.message,
          stack: errorInfo.componentStack || error.stack,
        }),
      }).catch(() => {});
    } catch {
      // Ignore network errors during client error reporting
    }
  }

  handleAutoRecover = () => {
    // Reload loop protection: Prevent more than 5 reloads in 30 seconds
    const now = Date.now();
    const reloadHistory = JSON.parse(sessionStorage.getItem('dreamers_reload_history') || '[]');
    const recentReloads = reloadHistory.filter((t: number) => now - t < 30000);
    
    if (recentReloads.length >= 5) {
      this.setState({ reloadBlocked: true });
      return;
    }
    
    recentReloads.push(now);
    sessionStorage.setItem('dreamers_reload_history', JSON.stringify(recentReloads));
    
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleQuickRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <motion.div 
          initial="initial"
          animate="animate"
          variants={fadeIn}
          className="min-h-screen bg-slate-950 text-light-green flex items-center justify-center p-6"
        >
          <div className="bg-slate-900 border border-red-500/30 rounded-3xl p-8 max-w-lg w-full shadow-2xl space-y-6 text-center">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-center mx-auto">
              <ShieldAlert className="w-8 h-8 text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-light-green">
                Something went wrong
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                An unexpected interface error occurred. You can reload to restore the session.
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-light-green-border/5 text-left overflow-hidden">
              <p className="text-[11px] font-mono text-amber-300 break-all">
                {this.state.error?.message || 'Rendering error encountered.'}
              </p>
              {this.state.reloadBlocked && (
                <p className="text-[11px] font-bold text-red-400 mt-2">
                  Multiple reload attempts detected. Please try Quick Retry or wait a moment.
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={this.handleQuickRetry}
                className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-light-green rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 transition-all border border-slate-700"
              >
                <span>Quick Retry</span>
              </button>
              <button
                onClick={this.handleAutoRecover}
                className="flex-2 py-3.5 bg-blue-600 hover:bg-blue-700 text-light-green rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 transition-all shadow-lg shadow-blue-500/25"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload App</span>
              </button>
            </div>
          </div>
        </motion.div>
      );
    }
    return this.props.children;
  }
}

export default function SystemHealthGuard() {
  // Clean UI: No telemetry or status indicators in the UI
  return null;
}
