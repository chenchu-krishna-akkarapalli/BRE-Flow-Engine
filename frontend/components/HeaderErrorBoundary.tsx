"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class HeaderErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("HeaderErrorBoundary caught an error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <header className="h-[52px] border-b border-slate-200/80 bg-white sticky top-0 z-30 shadow-2xs shrink-0 px-4 sm:px-6 flex items-center justify-between gap-4 select-none">
            <div className="flex-1" />
          </header>
        )
      );
    }

    return this.props.children;
  }
}
