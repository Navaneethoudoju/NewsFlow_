import { ReactNode } from "react";
import { Inbox, AlertTriangle, Loader2 } from "lucide-react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-rule bg-white/60 px-6 py-14 text-center">
      <div className="text-ink-faint">{icon ?? <Inbox size={28} strokeWidth={1.5} />}</div>
      <p className="font-medium text-ink">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-faint">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-14 text-ink-faint">
      <Loader2 size={18} className="animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-status-overdue/20 bg-status-overdue/5 px-6 py-14 text-center">
      <AlertTriangle size={26} className="text-status-overdue" strokeWidth={1.5} />
      <p className="text-sm text-ink">{message}</p>
    </div>
  );
}
