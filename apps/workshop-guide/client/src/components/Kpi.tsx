import { Skeleton } from '@databricks/appkit-ui/react';

/** KPI tile of the trainer views. `value` null = loading. */
export function Kpi({ label, value, note }: { label: string; value: string | null; note: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      {value === null ? <Skeleton className="mt-2 h-7 w-16" /> : <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>}
      <div className="mt-1 text-xs text-muted-foreground">{note}</div>
    </div>
  );
}
