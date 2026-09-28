"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  name?: string;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.name || "Component"}] Uncaught error:`, error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          aria-live="assertive"
          className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-danger/30 bg-danger-bg/60 p-6 text-center text-ink shadow-sm backdrop-blur-md"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/10 text-danger border border-danger/20">
            <AlertTriangle size={24} />
          </div>

          <div className="max-w-md">
            <h3 className="text-base font-bold text-ink">
              {this.props.name ? `${this.props.name} failed to load` : "Something went wrong"}
            </h3>
            <p className="mt-1 text-xs text-ink-muted leading-relaxed">
              {this.state.error?.message || "An unexpected error occurred while rendering this component. You can reload this section without losing your entered data."}
            </p>
          </div>

          <button
            type="button"
            onClick={this.handleReset}
            className="flex min-h-[40px] items-center gap-2 rounded-xl bg-white border border-line px-4 py-2 text-xs font-bold text-ink shadow-xs transition-all hover:bg-bg-raised hover:border-line-strong active:scale-95 cursor-pointer"
          >
            <RefreshCw size={14} />
            <span>Try again</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
