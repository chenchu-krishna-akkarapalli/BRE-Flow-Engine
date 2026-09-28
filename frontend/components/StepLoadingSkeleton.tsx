import React from "react";

interface StepLoadingSkeletonProps {
  stepNumber?: number;
}

export function StepLoadingSkeleton({ stepNumber }: StepLoadingSkeletonProps) {
  return (
    <div
      role="status"
      aria-label={`Loading step ${stepNumber ?? ""} content`}
      className="flex flex-col gap-6 animate-pulse w-full max-w-full"
    >
      {/* Step Header Placeholder */}
      <div className="flex items-center gap-3">
        <div className="h-6 w-20 rounded-md bg-slate-200/80" />
        <div className="h-6 w-48 rounded-md bg-slate-200/80" />
      </div>

      {/* Primary Field Skeleton */}
      <div className="flex flex-col gap-2">
        <div className="h-4 w-1/3 rounded bg-slate-200/90" />
        <div className="h-11 w-full rounded-xl bg-slate-100 border border-slate-200/60" />
      </div>

      {/* Dual Column Grid Skeleton */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <div className="h-4 w-2/5 rounded bg-slate-200/90" />
          <div className="h-11 w-full rounded-xl bg-slate-100 border border-slate-200/60" />
        </div>
        <div className="flex flex-col gap-2">
          <div className="h-4 w-1/2 rounded bg-slate-200/90" />
          <div className="h-11 w-full rounded-xl bg-slate-100 border border-slate-200/60" />
        </div>
      </div>

      {/* Radio/Card Options Placeholder */}
      <div className="flex flex-col gap-2.5">
        <div className="h-4 w-2/5 rounded bg-slate-200/90" />
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          <div className="h-14 rounded-xl border border-slate-200/60 bg-slate-100/70 p-3" />
          <div className="h-14 rounded-xl border border-slate-200/60 bg-slate-100/70 p-3" />
          <div className="h-14 rounded-xl border border-slate-200/60 bg-slate-100/70 p-3" />
        </div>
      </div>

      {/* Secondary Field Skeleton */}
      <div className="flex flex-col gap-2">
        <div className="h-4 w-1/4 rounded bg-slate-200/90" />
        <div className="h-11 w-full rounded-xl bg-slate-100 border border-slate-200/60" />
      </div>

      <span className="sr-only">Loading form step...</span>
    </div>
  );
}

export default StepLoadingSkeleton;
